import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as input from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RateLimitLine } from "@/components/ui/rate-limit-line";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { tokens, useTheme } from "@/components/ui/theme";
import type { UsageLimitRow } from "@/lib/oauth/types";
import { getConnectionStatus, type ConnectionStatus } from "@/lib/oauth/manager";
import type { AIModelCardConfig } from "@/lib/model-cards";
import { SubscriptionPanel } from "@/components/subscription-card";
import { useAppStore } from "@/store/app-store";
import type { ProviderConfig, ProviderId, ProviderSnapshot } from "@/types/domain";

export function AIModelCard({ item, refreshNonce }: { item: AIModelCardConfig; refreshNonce: number }) {
  const { providerConfigs, snapshots } = useAppStore();
  const [subscriptionStatus, setSubscriptionStatus] = useState<ConnectionStatus | null>(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Mount = passive (cache-only for Claude); a bumped `refreshNonce` is a
    // user-initiated refresh, so force a real network fetch for everyone.
    const userInitiated = didMountRef.current;
    didMountRef.current = true;
    async function loadStatus() {
      if (!item.subscriptionProviderId) {
        setSubscriptionStatus(null);
        return;
      }
      const next = await getConnectionStatus(item.subscriptionProviderId, {
        allowNetwork: userInitiated || item.subscriptionProviderId !== "claude-sub",
        force: userInitiated,
      }).catch((error) => ({
        kind: "error" as const,
        message: error instanceof Error ? error.message : "Could not load subscription status.",
      }));
      if (!cancelled) setSubscriptionStatus(next);
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [item.subscriptionProviderId, refreshNonce]);

  const theme = useTheme();
  const isDark = theme.background === tokens.dark.background;
  const apiConfigured = item.apiProviderId ? isApiConfigured(item.apiProviderId, providerConfigs[item.apiProviderId]) : false;
  const apiSnapshot = item.apiProviderId ? snapshots[item.apiProviderId] : null;
  const hasApi = Boolean(item.apiProviderId);
  const summary = buildHomeSummary(apiConfigured, apiSnapshot, subscriptionStatus, hasApi);
  const title = item.title.split(" / ")[0];

  return (
    <Link href={`/model/${item.id}`} asChild>
      <Pressable
        onPress={() => Haptics.selectionAsync()}
        style={{ marginBottom: 12 }}
      >
        <Card padding={4} style={{ overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
            {/* Provider logo (falls back to initials when no logo is available).
                Real brand logos render with no background; mono glyphs follow
                the theme foreground so they read in light and dark. */}
            {item.logo ? (
              <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
                <Image
                  source={!isDark && item.logo.sourceLight ? item.logo.sourceLight : item.logo.source}
                  style={{ width: 34, height: 34 }}
                  contentFit="contain"
                  tintColor={item.logo.tint === "foreground" ? theme.foreground : undefined}
                />
              </View>
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: `${item.accent}18`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text size="lg" family="sans" weight="bold" style={{ color: item.accent }}>
                  {item.initials}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="xs" family="mono" color="muted" numberOfLines={1} style={{ letterSpacing: 1 }}>
                {item.subscriptionProviderId ? "SUBSCRIPTION" : "API"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text size="2xl" family="sans" weight="bold" numberOfLines={1}>
                  {title}
                </Text>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: item.accent,
                    marginLeft: 2,
                  }}
                />
              </View>
              <Text size="xs" family="mono" color="muted" numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            <Image source="sf:chevron.right" style={{ width: 14, height: 14, tintColor: theme.mutedForeground }} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {item.subscriptionProviderId ? (
              <StatusBadge
                label="Sub"
                status={subscriptionSummary(subscriptionStatus)}
                variant={subscriptionStatus?.kind === "connected" ? "success" : subscriptionStatus?.kind === "error" ? "destructive" : "secondary"}
              />
            ) : null}
            {item.apiProviderId ? (
              <StatusBadge
                label="API"
                status={apiConfigured ? apiSnapshot?.statusLabel ?? "Ready" : "Needs key"}
                variant={apiSnapshot?.mode === "live" ? "success" : apiSnapshot?.mode === "failed" ? "destructive" : apiSnapshot?.mode === "needs-key" ? "warning" : "secondary"}
              />
            ) : null}
          </View>

          {summary.subscriptionRows && summary.subscriptionRows.length > 0 ? (
            <View style={{ gap: 10, backgroundColor: theme.muted, borderRadius: 10, padding: 10 }}>
              {summary.subscriptionRows.map((row, idx) => (
                <UsageRow key={idx} row={row} accent={item.accent} />
              ))}
            </View>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 16 }}>
                {summary.stats.map((stat) => (
                  <View key={stat.label} style={{ flex: 1, gap: 3 }}>
                    <Text size="xs" family="mono" weight="medium" color="muted" numberOfLines={1}>
                      {stat.label.toUpperCase()}
                    </Text>
                    <Text size="lg" family="sans" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                      {stat.value}
                    </Text>
                  </View>
                ))}
              </View>
              {summary.progress ? (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <Text size="xs" family="mono" weight="medium" color="muted">
                      {summary.progress.label}
                    </Text>
                    <Text size="xs" family="mono" weight="semibold">
                      {Math.round(summary.progress.percent * 100)}%
                    </Text>
                  </View>
                  <RateLimitLine value={summary.progress.percent} color={item.accent} />
                </View>
              ) : null}
            </>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}


function StatusBadge({ label, status, variant }: { label: string; status: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" }) {
  const badgeVariant: typeof variant = variant === "secondary" ? "outline" : variant;
  return (
    <Badge variant={badgeVariant} size="sm">
      {`${label} · ${status}`}
    </Badge>
  );
}

function UsageRow({ row, accent }: { row: UsageLimitRow; accent: string }) {
  const theme = useTheme();
  const pct = row.percentUsed;
  const detail =
    pct !== null
      ? `${pct}% used`
      : row.used !== null && row.limit !== null
        ? `${formatInt(row.used)} / ${formatInt(row.limit)}`
        : row.used !== null
          ? formatInt(row.used)
          : "—";

  const remaining = pct !== null ? 1 - pct / 100 : row.used !== null && row.limit !== null && row.limit > 0 ? 1 - row.used / row.limit : null;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text size="sm" family="sans" weight="medium">
          {row.label}
        </Text>
        <Text size="sm" family="mono" color="muted" style={{ fontVariant: ["tabular-nums"] }}>
          {detail}
        </Text>
      </View>
      {remaining !== null ? (
        <RateLimitLine value={remaining} color={accent} />
      ) : null}
      {row.resetHint ? (
        <Text size="xs" family="mono" color="muted">
          {row.resetHint}
        </Text>
      ) : null}
    </View>
  );
}

export function ModelDetailPanel({ item }: { item: AIModelCardConfig }) {
  const theme = useTheme();
  const { providerConfigs, saveProviderConfig, refreshProvider } = useAppStore();
  const [localRefreshNonce, setLocalRefreshNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const apiConfigured = item.apiProviderId ? isApiConfigured(item.apiProviderId, providerConfigs[item.apiProviderId]) : false;

  async function refreshAll() {
    setRefreshing(true);
    Haptics.selectionAsync();
    try {
      if (item.subscriptionProviderId) setLocalRefreshNonce((n) => n + 1);
      if (item.apiProviderId && apiConfigured) await refreshProvider(item.apiProviderId);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card padding={5}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.accent }} />
          <View style={{ flex: 1 }}>
            <Text size="xl" family="sans" weight="bold" numberOfLines={1}>
              {item.title}
            </Text>
            <Text size="sm" family="mono" color="muted" numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={refreshAll}
          disabled={refreshing}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.muted }}
        >
          <Image source="sf:arrow.clockwise" style={{ width: 12, height: 12, tintColor: useTheme().foreground }} />
          <Text size="xs" family="mono" weight="semibold">
            {refreshing ? "Refreshing..." : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {item.subscriptionProviderId ? <SubscriptionPanel providerId={item.subscriptionProviderId} refreshNonce={localRefreshNonce} /> : null}

      {item.subscriptionProviderId && item.apiProviderId ? <Separator style={{ marginVertical: 18 }} /> : null}

      {item.apiProviderId ? (
        <View>
          {apiConfigured ? (
            <>
              <Text size="lg" weight="semibold" style={{ marginBottom: 12 }}>
                API telemetry
              </Text>
              <ApiSnapshotList snapshot={useAppStore().snapshots[item.apiProviderId]} />
              <Link href={`/provider/${item.apiProviderId}`} asChild>
                <Pressable style={{ marginTop: 14, alignSelf: "flex-start" }}>
                  <Text size="sm" weight="semibold" color="primary">
                    API settings →
                  </Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <ApiSetupPanel providerId={item.apiProviderId} config={providerConfigs[item.apiProviderId]} onSave={(next) => saveProviderConfig(item.apiProviderId!, next)} />
          )}
        </View>
      ) : null}
    </Card>
  );
}

function ApiSnapshotList({ snapshot }: { snapshot: ProviderSnapshot }) {
  return (
    <View style={{ gap: 10 }}>
      <StatRow label="Status" value={snapshot.statusLabel} />
      <StatRow label="Tokens" value={formatInt(snapshot.usage.tokensUsed)} />
      <StatRow label="Requests" value={formatInt(snapshot.usage.requestsUsed)} />
      <StatRow label="Monthly spend" value={`$${snapshot.usage.monthlySpendUsd.toFixed(2)}`} />
      <StatRow label="Balance" value={snapshot.balanceLabel ?? "—"} />
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text size="sm" color="muted">
        {label}
      </Text>
      <Text size="sm" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

function ApiSetupPanel({
  providerId,
  config,
  onSave,
}: {
  providerId: ProviderId;
  config: ProviderConfig;
  onSave: (config: ProviderConfig) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const copy = apiSetupCopy(providerId);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const next = copy.field === "adminKey" ? { ...config, adminKey: value.trim() } : { ...config, apiKey: value.trim() };
      await onSave(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Text size="lg" weight="semibold">{copy.title}</Text>
      <Text size="sm" color="muted">{copy.body}</Text>
      <input.Input value={value} onChangeText={setValue} secureTextEntry placeholder={copy.placeholder} />
      <Button onPress={save} disabled={saving || !value.trim()} size="sm">
        {saving ? "Saving..." : copy.button}
      </Button>
    </View>
  );
}


function isApiConfigured(providerId: ProviderId, config: ProviderConfig) {
  if (providerId === "kimi") return Boolean(config.apiKey.trim());
  return Boolean(config.adminKey.trim() || config.apiKey.trim());
}

function apiSetupCopy(providerId: ProviderId) {
  if (providerId === "openai") {
    return { field: "adminKey" as const, title: "Add an OpenAI admin key", body: "API usage and cost reporting needs an organization admin key.", placeholder: "OpenAI admin key", button: "Save admin key" };
  }
  if (providerId === "anthropic") {
    return { field: "adminKey" as const, title: "Add an Anthropic admin key", body: "API usage and organization rate limits need an Anthropic Admin API key.", placeholder: "Anthropic admin key", button: "Save admin key" };
  }
  return { field: "apiKey" as const, title: "Add a Moonshot API key", body: "Kimi API mode can show live account balance once a Moonshot API key is stored.", placeholder: "Moonshot API key", button: "Save API key" };
}

function subscriptionSummary(status: ConnectionStatus | null) {
  if (!status || status.kind === "disconnected") return "Not connected";
  if (status.kind === "error") return "Issue";
  return status.usage.planLabel ?? "Connected";
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}

function formatInt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function buildHomeSummary(
  apiConfigured: boolean,
  apiSnapshot: ProviderSnapshot | null,
  subscriptionStatus: ConnectionStatus | null,
  hasApi: boolean,
) {
  const subscriptionConnected = subscriptionStatus?.kind === "connected";
  const primarySub = subscriptionConnected ? preferredSubscriptionRow(subscriptionStatus.usage) : null;
  const secondarySub = subscriptionConnected ? subscriptionStatus.usage.limits.find((row) => row.label !== primarySub?.label) ?? null : null;
  const apiPercent = apiSnapshot ? computeApiLimitPercent(apiSnapshot) : null;

  if (subscriptionConnected && apiConfigured && apiSnapshot) {
    return {
      mode: "both" as const,
      stats: [
        { label: "API tokens", value: compactNumber(apiSnapshot.usage.tokensUsed) },
        { label: shortUsageLabel(primarySub?.label ?? "5-hour"), value: formatUsageRow(primarySub) },
      ],
      progress: subscriptionPercent(primarySub) ?? apiPercent,
      subscriptionRows: undefined,
    };
  }

  if (subscriptionConnected) {
    const rows = subscriptionStatus.usage.limits;
    return {
      mode: "subscription" as const,
      stats: rows.length > 0 ? [] : [
        { label: shortUsageLabel(primarySub?.label ?? "Current"), value: formatUsageRow(primarySub) },
        { label: shortUsageLabel(secondarySub?.label ?? "Plan"), value: formatUsageRow(secondarySub, subscriptionStatus.usage.planLabel ?? "Connected") },
      ],
      progress: rows.length > 0 ? null : subscriptionPercent(primarySub),
      subscriptionRows: rows.length > 0 ? rows : undefined,
    };
  }

  if (apiConfigured && apiSnapshot) {
    return {
      mode: "api" as const,
      stats: [
        { label: "Monthly spend", value: `$${apiSnapshot.usage.monthlySpendUsd.toFixed(2)}` },
        { label: "API tokens", value: compactNumber(apiSnapshot.usage.tokensUsed) },
        { label: apiSnapshot.balanceLabel ? "Balance" : "RPM left", value: apiSnapshot.balanceLabel ?? formatRemaining(apiSnapshot) },
      ],
      progress: apiPercent,
      subscriptionRows: undefined,
    };
  }

  return {
    mode: "empty" as const,
    stats: hasApi
      ? [
          { label: "Subscription", value: subscriptionSummary(subscriptionStatus) },
          { label: "API", value: apiSnapshot ? apiSnapshot.statusLabel : "Add key" },
        ]
      : [
          { label: "Subscription", value: subscriptionSummary(subscriptionStatus) },
          { label: "Plan", value: "—" },
        ],
    progress: null,
    subscriptionRows: undefined,
  };
}

function preferredSubscriptionRow(usage: NonNullable<Extract<ConnectionStatus, { kind: "connected" }>["usage"]>) {
  return usage.limits.find((row) => /5.?hour/i.test(row.label)) ?? usage.summary ?? usage.limits[0] ?? null;
}

function subscriptionPercent(row: UsageLimitRow | null) {
  if (!row) return null;
  if (typeof row.percentUsed === "number") {
    return { label: shortUsageLabel(row.label), detail: row.resetHint ?? undefined, percent: Math.max(0, Math.min(1, row.percentUsed / 100)) };
  }
  if (typeof row.used === "number" && typeof row.limit === "number" && row.limit > 0) {
    return { label: shortUsageLabel(row.label), detail: row.resetHint ?? undefined, percent: Math.max(0, Math.min(1, row.used / row.limit)) };
  }
  return null;
}

function computeApiLimitPercent(snapshot: ProviderSnapshot) {
  const limit = snapshot.limits.requestsPerMinuteLimit;
  const remaining = snapshot.limits.requestsRemaining;
  if (typeof limit === "number" && limit > 0 && typeof remaining === "number") {
    return { label: "Requests / min", detail: `${compactNumber(Math.max(0, remaining))} left`, percent: Math.max(0, Math.min(1, (limit - Math.max(0, remaining)) / limit)) };
  }
  const tokenLimit = snapshot.limits.tokensPerMinuteLimit;
  if (typeof tokenLimit === "number" && tokenLimit > 0 && snapshot.usage.tokensUsed > 0) {
    return { label: "Tokens / min", detail: `${compactNumber(tokenLimit)} limit`, percent: Math.max(0, Math.min(1, snapshot.usage.tokensUsed / tokenLimit)) };
  }
  return null;
}

function formatUsageRow(row: UsageLimitRow | null, fallback = "—") {
  if (!row) return fallback;
  if (typeof row.percentUsed === "number") return `${Math.round(row.percentUsed)}%`;
  if (typeof row.used === "number" && typeof row.limit === "number") return `${compactNumber(row.used)}/${compactNumber(row.limit)}`;
  if (typeof row.used === "number") return compactNumber(row.used);
  return fallback;
}

function shortUsageLabel(label: string) {
  if (/5.?hour/i.test(label)) return "5-hour";
  if (/weekly/i.test(label) || /seven/i.test(label)) return "Weekly";
  if (/primary/i.test(label)) return "5-hour";
  return label;
}

function formatRemaining(snapshot: ProviderSnapshot) {
  const remaining = snapshot.limits.requestsRemaining;
  return typeof remaining === "number" ? compactNumber(remaining) : "—";
}
