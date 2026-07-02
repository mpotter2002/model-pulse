import { makeModelCards } from "@/lib/model-cards";
import { getConnectionStatus } from "@/lib/oauth/manager";
import type { SubscriptionUsage } from "@/lib/oauth/types";
import { PROVIDERS, PROVIDER_ORDER } from "@/lib/providers";
import type { ModelCardId, ProviderId, ProviderSnapshot, RateLimitStyle, WidgetConfig } from "@/types/domain";
import { signalStackWidget } from "@/widgets/signal-stack-widget";

type SnapshotMap = Record<ProviderId, ProviderSnapshot>;

export async function syncSignalStackWidget(snapshots: SnapshotMap, config: WidgetConfig, rateLimitStyle: RateLimitStyle) {
  const modelCards = makeModelCards();
  const visibleModelIds =
    config.visibleModelCardIds.length > 0 ? config.visibleModelCardIds : modelCards.map((card) => card.id);
  const visibleCards = modelCards
    .filter((card) => visibleModelIds.includes(card.id))
    // Put the chosen primary (focusedModelCardId) first so it drives the
    // widget's "Overview" headline / focus dot.
    .sort((a, b) => {
      if (a.id === config.focusedModelCardId) return -1;
      if (b.id === config.focusedModelCardId) return 1;
      return 0;
    });
  const subscriptionStatuses = await Promise.all(
    visibleCards.map(async (card) => {
      if (!card.subscriptionProviderId) return [card.id, null] as const;
      return [
        card.id,
        await getConnectionStatus(card.subscriptionProviderId, {
          allowNetwork: card.subscriptionProviderId !== "claude-sub",
        }),
      ] as const;
    }),
  );
  const subscriptionStatusById = Object.fromEntries(subscriptionStatuses) as Record<
    ModelCardId,
    Awaited<ReturnType<typeof getConnectionStatus>> | null
  >;
  const totalSpend = visibleCards.reduce((sum, card) => {
    let spend = 0;
    if (card.apiProviderId) {
      const snap = snapshots[card.apiProviderId];
      if (isLiveSnapshot(snap)) spend += snap.usage.monthlySpendUsd;
    }
    // Match the in-app widget preview: subscription spend is the user's
    // configured monthly price for each visible subscription card. Do not gate
    // this on OAuth status; otherwise the home-screen widget can show a
    // different spend total from the preview whenever provider status is stale,
    // cache-only, throttled, or temporarily disconnected.
    if (card.subscriptionProviderId) spend += parseUsd(config.subscriptionPricesUsd[card.id]);
    return sum + spend;
  }, 0);
  const totalTokens = visibleCards.reduce((sum, card) => {
    let tokens = 0;
    if (card.apiProviderId) {
      const snap = snapshots[card.apiProviderId];
      if (isLiveSnapshot(snap)) tokens += snap.usage.tokensUsed;
    }
    // Tokens are only available from API providers; subscription plans do not expose raw token counts.
    return sum + tokens;
  }, 0);
  const totalBalance = visibleCards.reduce((sum, card) => {
    if (!card.apiProviderId) return sum;
    const snap = snapshots[card.apiProviderId];
    if (!isLiveSnapshot(snap)) return sum;
    return sum + parseUsd(snap.balanceLabel ?? undefined);
  }, 0);
  const hasLiveApiData = visibleCards.some((card) => card.apiProviderId && isLiveSnapshot(snapshots[card.apiProviderId]));
  // Ensure we always have at least one card for the widget, even if it's just a placeholder
  const cards = visibleCards.map((card) => {
    const apiSnapshot = card.apiProviderId ? snapshots[card.apiProviderId] : null;
    const subStatus = subscriptionStatusById[card.id];
    const subscriptionConnected = subStatus?.kind === "connected";
    const metric = subscriptionConnected
      ? subscriptionMetric(subStatus.usage, config.metricMode, config.subscriptionPricesUsd[card.id])
      : apiSnapshot
        ? widgetMetric(apiSnapshot, config.metricMode)
        : "Set up";
    const ratio = subscriptionConnected
      ? subscriptionRatio(subStatus.usage)
      : apiSnapshot
        ? providerLimitRatio(apiSnapshot)
        : null;
    return {
      id: card.id,
      ...(card.apiProviderId ? { providerId: card.apiProviderId } : {}),
      label: card.title.split(" / ")[0],
      status: subscriptionConnected ? subStatus.usage.planLabel ?? "Subscription connected" : apiSnapshot?.statusLabel ?? "Not connected",
      metric,
      ...(ratio !== null ? { ratio } : {}),
      ...(subscriptionConnected ? { limitRows: subscriptionLimitRows(card.title.split(" / ")[0], card.accent, subStatus.usage) } : {}),
      accent: card.accent,
    };
  });

  // Ensure cards is never empty to prevent widget crash
  const safeCards = cards.length > 0 ? cards : [{
    id: "openai" as ModelCardId,
    label: "SignalStack",
    status: "Open app to sync",
    metric: "—",
    accent: "#8E8E93",
  }];

  try {
    await signalStackWidget.updateTimeline([
      {
        date: new Date(),
        props: {
          headline: "SignalStack",
          subheadline: `${visibleCards.length} model${visibleCards.length === 1 ? "" : "s"}`,
          totalSpend: `$${totalSpend.toFixed(0)}`,
          totalTokens: hasLiveApiData ? compact(totalTokens) : "",
          totalBalance: `$${totalBalance.toFixed(2)}`,
          hasLiveApiData,
          metricLabel: metricLabel(config.metricMode),
          updatedAt: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          rateLimitStyle,
          cards: safeCards,
        },
      },
    ]);
  } catch (error) {
    console.warn("[SignalStack] Widget timeline update failed:", error);
  }
}

function widgetMetric(snapshot: ProviderSnapshot, mode: WidgetConfig["metricMode"]) {
  if (mode === "api") return snapshot.balanceLabel ?? `$${snapshot.usage.monthlySpendUsd.toFixed(2)}`;
  if (mode === "subscription") return limitMetric(snapshot);
  return `$${snapshot.usage.monthlySpendUsd.toFixed(2)}`;
}
function isLiveSnapshot(snapshot: ProviderSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return snapshot.mode === "live";
}

function subscriptionMetric(
  usage: SubscriptionUsage,
  mode: WidgetConfig["metricMode"],
  monthlyPrice: string,
) {
  if (mode === "api") return usage.planLabel ?? "Sub";
  const summary = firstUsableUsageRow(usage) ?? usage.summary ?? usage.limits[0] ?? null;
  if (mode === "subscription") {
    if (!summary) return "No limit";
    if (summary.percentUsed !== null) return `${summary.percentUsed}%`;
    if (summary.used !== null && summary.limit !== null) return `${compact(summary.used)}/${compact(summary.limit)}`;
    return summary.label;
  }
  if (summary?.percentUsed !== null && summary?.percentUsed !== undefined) return `${summary.percentUsed}%`;
  return usage.planLabel ?? "Sub";
}
function limitMetric(snapshot: ProviderSnapshot) {
  if (snapshot.limits.requestsRemaining !== null && snapshot.limits.requestsPerMinuteLimit !== null) {
    return `${compact(snapshot.limits.requestsRemaining)}/${compact(snapshot.limits.requestsPerMinuteLimit)}`;
  }
  if (snapshot.limits.tokensPerMinuteLimit !== null) return `${compact(snapshot.limits.tokensPerMinuteLimit)}/m`;
  return snapshot.limits.resetsAtLabel ?? "Limits";
}

function providerLimitRatio(snapshot: ProviderSnapshot) {
  const remaining = snapshot.limits.requestsRemaining;
  const total = snapshot.limits.requestsPerMinuteLimit;
  if (remaining === null || remaining === undefined || total === null || total === undefined || total <= 0) {
    return null;
  }
  return Math.max(0, remaining) / total;
}

function subscriptionRatio(usage: SubscriptionUsage) {
  const summary = firstUsableUsageRow(usage) ?? usage.summary ?? usage.limits[0] ?? null;
  if (!summary) return null;
  if (summary.percentUsed !== null && summary.percentUsed !== undefined) {
    return Math.max(0, 1 - summary.percentUsed / 100);
  }
  if (summary.used !== null && summary.used !== undefined && summary.limit !== null && summary.limit !== undefined && summary.limit > 0) {
    return Math.max(0, 1 - summary.used / summary.limit);
  }
  return null;
}

function firstUsableUsageRow(usage: SubscriptionUsage) {
  return [usage.summary, ...usage.limits].find((row) => {
    if (!row) return false;
    if (row.percentUsed !== null && row.percentUsed !== undefined) return true;
    return row.used !== null && row.used !== undefined && row.limit !== null && row.limit !== undefined && row.limit > 0;
  }) ?? null;
}

function subscriptionLimitRows(label: string, accent: string, usage: SubscriptionUsage) {
  const seen = new Set<string>();
  let emitted = 0;
  return usage.limits.flatMap((row, index) => {
    const ratio =
      row.percentUsed !== null && row.percentUsed !== undefined
        ? Math.max(0, 1 - row.percentUsed / 100)
        : row.used !== null && row.used !== undefined && row.limit !== null && row.limit !== undefined && row.limit > 0
          ? Math.max(0, 1 - row.used / row.limit)
          : null;
    if (ratio === null) return [];
    // Only the first window for a provider carries the provider name
    // (e.g. "Claude 5h"); later windows just show the window ("Weekly") so the
    // label stays short enough to fit the widget's narrow label column.
    const rowLabel = compactLimitLabel(label, row.label, emitted === 0);
    const key = `${rowLabel}:${Math.round(ratio * 1000)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    emitted += 1;
    return [{
      id: `${label.toLowerCase()}-${index}`,
      label: rowLabel,
      ratio: Math.max(0, Math.min(1, ratio)),
      accent,
    }];
  });
}

function compactLimitLabel(providerLabel: string, rowLabel: string, includeProvider: boolean) {
  const cleaned = rowLabel
    .replace("Standard · ", "Std ")
    .replace("5-hour", "5h")
    .replace("Monthly", "Month")
    .replace(" window", "");
  return includeProvider ? `${providerLabel} ${cleaned}` : cleaned;
}

function metricLabel(mode: WidgetConfig["metricMode"]) {
  if (mode === "api") return "Balance";
  if (mode === "subscription") return "Limits";
  return "Balance";
}
function parseUsd(value: string | undefined) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}
