import { makeModelCards } from "@/lib/model-cards";
import { getConnectionStatus } from "@/lib/oauth/manager";
import type { SubscriptionUsage } from "@/lib/oauth/types";
import type { ModelCardId, ProviderId, ProviderSnapshot, RateLimitStyle, WidgetConfig } from "@/types/domain";
import { signalStackWidget } from "@/widgets/signal-stack-widget";

type SnapshotMap = Record<ProviderId, ProviderSnapshot>;

export async function syncSignalStackWidget(
  snapshots: SnapshotMap,
  config: WidgetConfig,
  rateLimitStyle: RateLimitStyle,
  hiddenModelCardIds: ModelCardId[] = [],
) {
  const modelCards = makeModelCards();
  const visibleModelIds =
    config.visibleModelCardIds.length > 0 ? config.visibleModelCardIds : modelCards.map((card) => card.id);
  const visibleCards = modelCards
    // Exclude cards the user hid on the home page so the widget's card list and
    // spend total stay in lockstep with the in-app total. Without this, a card
    // that is hidden on the home page but still in visibleModelCardIds adds its
    // configured price to the widget's SPEND tile only, causing a mismatch.
    .filter((card) => visibleModelIds.includes(card.id) && !hiddenModelCardIds.includes(card.id))
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
    // API mode is the exception: it shows API spend alone so the total truly
    // resets to $0 at month start for prepaid-credit users.
    if (card.subscriptionProviderId && config.metricMode !== "api") spend += parseUsd(config.subscriptionPricesUsd[card.id]);
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
  const hasBalanceData = visibleCards.some((card) => {
    if (!card.apiProviderId) return false;
    const snap = snapshots[card.apiProviderId];
    return isLiveSnapshot(snap) && snap.balanceLabel != null;
  });
  // "Active" = the provider is actually connected/enabled, not just visible:
  // a subscription that is logged in, or an API key that returned live data.
  // The widget PROVIDERS tile counts this (e.g. 5 instead of 13) so the number
  // reflects what the user set up, not the full catalog of supported providers.
  const activeCount = visibleCards.reduce((count, card) => {
    const subscriptionConnected = subscriptionStatusById[card.id]?.kind === "connected";
    const apiLive = card.apiProviderId ? isLiveSnapshot(snapshots[card.apiProviderId]) : false;
    return subscriptionConnected || apiLive ? count + 1 : count;
  }, 0);
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
      ...(() => {
        const label = card.title.split(" / ")[0];
        const subRows = subscriptionConnected
          ? subscriptionLimitRows(label, card.accent, subStatus.usage)
          : [];
        const apiRows = isLiveSnapshot(apiSnapshot)
          ? apiLimitRows(label, card.accent, apiSnapshot!)
          : [];
        // In API mode lead with API bars (budget / req-min); in subscription
        // mode lead with subscription windows. Either way fall back to the
        // other so a card never loses its bars just because one side is empty.
        const limitRows =
          config.metricMode === "api"
            ? (apiRows.length > 0 ? apiRows : subRows)
            : (subRows.length > 0 ? subRows : apiRows);
        return limitRows.length > 0 ? { limitRows } : {};
      })(),
      accent: card.accent,
    };
  });

  // Fairly cap limit rows across providers BEFORE handing to the widget:
  // every provider keeps its first 2 windows before any provider gets a
  // 3rd/4th, leftovers round-robin up to 13 total, and each provider's rows
  // stay contiguous so the colors stay grouped. Done here because the
  // expo-widgets SwiftUI transform can't run helpers/loops inside the widget.
  applyFairLimitRowCaps(cards, 13, 2);

  // Ensure cards is never empty to prevent widget crash
  const safeCards = cards.length > 0 ? cards : [{
    id: "openai" as ModelCardId,
    label: "Model Pulse",
    status: "Open app to sync",
    metric: "—",
    accent: "#8E8E93",
  }];

  try {
    await signalStackWidget.updateTimeline([
      {
        date: new Date(),
        props: {
          headline: "Model Pulse",
          subheadline: `${activeCount} provider${activeCount === 1 ? "" : "s"}`,
          providerCount: activeCount,
          totalSpend: `$${totalSpend.toFixed(0)}`,
          totalTokens: hasLiveApiData ? compact(totalTokens) : "",
          totalBalance: `$${totalBalance.toFixed(2)}`,
          hasLiveApiData,
          hasBalanceData,
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

/**
 * Bars for API-key providers: spend-vs-budget (when the user set a monthly
 * budget) and requests-remaining (when the provider/manual caps expose one).
 * Ratio is "fraction remaining" to match the subscription bars.
 */
function apiLimitRows(label: string, accent: string, snapshot: ProviderSnapshot) {
  const rows: Array<{ id: string; label: string; ratio: number; accent: string }> = [];
  const budget = snapshot.monthlyBudgetUsd;
  if (budget !== null && budget !== undefined && budget > 0) {
    const ratio = Math.max(0, Math.min(1, 1 - snapshot.usage.monthlySpendUsd / budget));
    rows.push({ id: `${label.toLowerCase()}-budget`, label: `${label} budget`, ratio, accent });
  }
  const rpmTotal = snapshot.limits.requestsPerMinuteLimit;
  const rpmRemaining = snapshot.limits.requestsRemaining;
  if (rpmRemaining !== null && rpmRemaining !== undefined && rpmTotal !== null && rpmTotal !== undefined && rpmTotal > 0) {
    const ratio = Math.max(0, Math.min(1, rpmRemaining / rpmTotal));
    rows.push({
      id: `${label.toLowerCase()}-rpm`,
      label: rows.length === 0 ? `${label} req/min` : "Req/min",
      ratio,
      accent,
    });
  }
  return rows;
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

/**
 * Mutates cards' limitRows so each provider keeps up to `guaranteed` rows
 * first, then leftover capacity (up to `total`) is distributed round-robin.
 * Rows stay in provider order / contiguous, so widget colors stay grouped.
 */
function applyFairLimitRowCaps(
  cards: Array<{ limitRows?: Array<unknown> }>,
  total: number,
  guaranteed: number,
) {
  const allot = cards.map(() => 0);
  let used = 0;
  for (let p = 0; p < cards.length && used < total; p += 1) {
    const available = cards[p].limitRows?.length ?? 0;
    const give = Math.min(guaranteed, available, total - used);
    allot[p] = give;
    used += give;
  }
  let progressed = true;
  while (used < total && progressed) {
    progressed = false;
    for (let p = 0; p < cards.length && used < total; p += 1) {
      const available = cards[p].limitRows?.length ?? 0;
      if (allot[p] < available) {
        allot[p] += 1;
        used += 1;
        progressed = true;
      }
    }
  }
  for (let p = 0; p < cards.length; p += 1) {
    if (cards[p].limitRows) {
      cards[p].limitRows = cards[p].limitRows!.slice(0, allot[p]);
    }
  }
}
