import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as input from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { InputCacheBreakdown } from "@/components/input-cache-breakdown";
import { RateLimitLine } from "@/components/ui/rate-limit-line";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { tokens, useTheme } from "@/components/ui/theme";
import type { UsageLimitRow } from "@/lib/oauth/types";
import { getConnectionStatus, type ConnectionStatus } from "@/lib/oauth/manager";
import type { AIModelCardConfig } from "@/lib/model-cards";
import { SubscriptionPanel } from "@/components/subscription-card";
import { useAppStore } from "@/store/app-store";
import type { HomeCardSource, ProviderConfig, ProviderId, ProviderModelUsage, ProviderSnapshot } from "@/types/domain";

const HOME_CARD_SOURCE_OPTIONS: Array<{ label: string; value: HomeCardSource; hint: string }> = [
  { label: "Subscription", value: "subscription", hint: "Plan limits first" },
  { label: "API", value: "api", hint: "Spend & tokens first" },
];

export function ProviderLogoMark({
  item,
  size = 52,
  logoSize = 34,
}: {
  item: Pick<AIModelCardConfig, "logo" | "initials" | "accent">;
  size?: number;
  logoSize?: number;
}) {
  const theme = useTheme();
  const isDark = theme.background === tokens.dark.background;

  if (item.logo) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Image
          source={!isDark && item.logo.sourceLight ? item.logo.sourceLight : item.logo.source}
          style={{ width: logoSize, height: logoSize }}
          contentFit="contain"
          tintColor={item.logo.tint === "foreground" ? theme.foreground : undefined}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(12, size / 4),
        backgroundColor: `${item.accent}18`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text size={size >= 44 ? "lg" : "sm"} family="sans" weight="bold" style={{ color: item.accent }}>
        {item.initials}
      </Text>
    </View>
  );
}

export function AIModelCard({ item, refreshNonce }: { item: AIModelCardConfig; refreshNonce: number }) {
  const { providerConfigs, snapshots, homeCardSource } = useAppStore();
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
  const apiConfigured = item.apiProviderId ? isApiConfigured(item.apiProviderId, providerConfigs[item.apiProviderId]) : false;
  const apiSnapshot = item.apiProviderId ? snapshots[item.apiProviderId] : null;
  const hasApi = Boolean(item.apiProviderId);
  const hasSubscription = Boolean(item.subscriptionProviderId);
  const preferredSource = homeCardSource[item.id] ?? "subscription";
  const summary = buildHomeSummary(apiConfigured, apiSnapshot, subscriptionStatus, hasApi, hasSubscription, preferredSource);
  const title = item.title.split(" / ")[0];

  return (
    <Link href={`/model/${item.id}`} asChild>
      <Pressable
        onPress={() => Haptics.selectionAsync()}
        style={{ marginBottom: 12 }}
      >
        <Card padding={4} style={{ overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <ProviderLogoMark item={item} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="xs" family="mono" color="muted" numberOfLines={1} style={{ letterSpacing: 1 }}>
                {item.subscriptionProviderId && item.apiProviderId
                  ? preferredSource === "api"
                    ? "API"
                    : "SUBSCRIPTION"
                  : item.subscriptionProviderId
                    ? "SUBSCRIPTION"
                    : "API"}
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
              {apiSnapshot?.usage.inputCache && apiConfigured && (preferredSource === "api" || !hasSubscription) ? (
                <InputCacheBreakdown snapshot={apiSnapshot} compact />
              ) : null}
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
  const {
    providerConfigs,
    saveProviderConfig,
    refreshProvider,
    homeCardSource,
    setHomeCardSource,
    providerDataSharingConsent,
    requestProviderDataSharingConsent,
  } = useAppStore();
  const [localRefreshNonce, setLocalRefreshNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const apiConfigured = item.apiProviderId ? isApiConfigured(item.apiProviderId, providerConfigs[item.apiProviderId]) : false;

  async function refreshAll() {
    if (providerDataSharingConsent !== "granted") {
      requestProviderDataSharingConsent();
      return;
    }
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
          <ProviderLogoMark item={item} size={40} logoSize={28} />
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
          <Image source="sf:arrow.clockwise" style={{ width: 12, height: 12, tintColor: theme.foreground }} />
          <Text size="xs" family="mono" weight="semibold">
            {refreshing ? "Refreshing..." : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {item.subscriptionProviderId && item.apiProviderId ? (
        <>
          <View style={{ marginBottom: 18 }}>
            <Text size="lg" weight="semibold">
              Home card
            </Text>
            <Text size="sm" color="muted" style={{ marginTop: 2, marginBottom: 12 }}>
              Choose which usage this card leads with on the home screen.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {HOME_CARD_SOURCE_OPTIONS.map((option) => {
                const current = homeCardSource[item.id] ?? "auto";
                const active = current === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      void setHomeCardSource(item.id, option.value);
                    }}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      backgroundColor: active ? theme.accent : theme.muted,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Text
                      size="sm"
                      family="mono"
                      weight="bold"
                      style={{ color: active ? theme.accentForeground : theme.foreground }}
                    >
                      {option.label.toUpperCase()}
                    </Text>
                    <Text
                      size="xs"
                      family="mono"
                      style={{ color: active ? theme.accentForeground : theme.mutedForeground, textAlign: "center" }}
                    >
                      {option.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Separator style={{ marginBottom: 18 }} />
        </>
      ) : null}

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
              {item.apiProviderId === "openrouter" && !providerConfigs.openrouter.adminKey.trim() ? (
                <OpenRouterManagementKeyPanel
                  config={providerConfigs.openrouter}
                  onSave={(next) => saveProviderConfig("openrouter", next)}
                />
              ) : null}
              <Link href={`/provider/${item.apiProviderId}`} asChild>
                <Pressable style={{ marginTop: 14, alignSelf: "flex-start" }}>
                  <Text size="sm" weight="semibold" color="primary">
                    API settings →
                  </Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <ApiSetupPanel
              providerId={item.apiProviderId}
              config={providerConfigs[item.apiProviderId]}
              onSave={(next) => saveProviderConfig(item.apiProviderId!, next)}
            />
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
      <StatRow label="Tokens" value={snapshot.usage.tokensAvailable === false ? "Not reported" : formatInt(snapshot.usage.tokensUsed)} />
      <StatRow label="Requests" value={snapshot.usage.requestsAvailable === false ? "Not reported" : formatInt(snapshot.usage.requestsUsed)} />
      <StatRow label="Monthly spend" value={snapshot.usage.spendAvailable === false ? "Not reported" : `$${snapshot.usage.monthlySpendUsd.toFixed(2)}`} />
      <InputCacheBreakdown snapshot={snapshot} />
      <StatRow label="Balance" value={snapshot.balanceLabel ?? "—"} />
      {snapshot.modelBreakdown ? (
        <ModelBreakdown
          rows={snapshot.modelBreakdown}
          windowLabel={snapshot.modelBreakdownWindowLabel}
        />
      ) : snapshot.modelBreakdownError ? (
        <View style={{ gap: 4, marginTop: 8 }}>
          <Text size="sm" weight="semibold" color="destructive">
            Model breakdown unavailable
          </Text>
          <Text size="xs" color="muted">
            {snapshot.modelBreakdownError}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ModelBreakdown({
  rows,
  windowLabel,
}: {
  rows: ProviderModelUsage[];
  windowLabel?: string | null;
}) {
  return (
    <View style={{ gap: 10, marginTop: 10 }}>
      <Separator />
      <View style={{ gap: 2 }}>
        <Text size="sm" weight="semibold">
          Model breakdown
        </Text>
        {windowLabel ? (
          <Text size="xs" color="muted">
            {windowLabel}
          </Text>
        ) : null}
      </View>
      {rows.length > 0 ? (
        rows.map((row) => <ModelUsageRow key={row.model} row={row} />)
      ) : (
        <Text size="sm" color="muted">
          No completed-day activity was reported for this API key.
        </Text>
      )}
    </View>
  );
}

function ModelUsageRow({ row }: { row: ProviderModelUsage }) {
  const tokenTotal = row.promptTokens + row.completionTokens + row.reasoningTokens;
  return (
    <View style={{ gap: 5, paddingVertical: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" weight="semibold" numberOfLines={1}>
            {compactModelName(row.model)}
          </Text>
          {row.providerName ? (
            <Text size="xs" color="muted" numberOfLines={1}>
              {row.providerName}
            </Text>
          ) : null}
        </View>
        <Text size="sm" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
          ${row.spendUsd.toFixed(2)}
        </Text>
      </View>
      <Text size="xs" color="muted" style={{ fontVariant: ["tabular-nums"] }}>
        {formatInt(row.requests)} requests · {compactNumber(tokenTotal)} tokens
      </Text>
    </View>
  );
}

function compactModelName(value: string) {
  const parts = value.split("/");
  return parts[parts.length - 1] || value;
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
  const [managementKey, setManagementKey] = useState(config.adminKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = apiSetupCopy(providerId);
  const { providerDataSharingConsent, requestProviderDataSharingConsent } = useAppStore();

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (providerDataSharingConsent !== "granted") {
      requestProviderDataSharingConsent();
      return;
    }
    if (providerId === "openai" && !trimmed.startsWith("sk-admin-")) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setError("That looks like a standard API key. OpenAI usage and cost reporting only works with an organization Admin key, which starts with sk-admin-. Create one at platform.openai.com > Settings > Organization > Admin keys. (Keys with 'All' permissions still can't read organization usage.)");
      return;
    }
    if (providerId === "anthropic" && !trimmed.startsWith("sk-ant-admin")) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setError("That looks like a standard API key. Anthropic usage, cost, and rate limits only work with an Admin API key, which starts with sk-ant-admin. Create one at console.anthropic.com > Settings > Admin keys.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const next =
        providerId === "openrouter"
          ? { ...config, apiKey: trimmed, adminKey: managementKey.trim() }
          : copy.field === "adminKey"
            ? { ...config, adminKey: trimmed }
            : { ...config, apiKey: trimmed };
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
      <input.Input
        value={value}
        onChangeText={(text) => {
          setValue(text);
          if (error) setError(null);
        }}
        secureTextEntry
        placeholder={copy.placeholder}
        invalid={Boolean(error)}
      />
      {providerId === "openrouter" ? (
        <View style={{ gap: 5 }}>
          <Text size="sm" weight="semibold">
            Management key (per-model breakdown)
          </Text>
          <input.Input
            value={managementKey}
            onChangeText={setManagementKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="OpenRouter management key"
          />
          <Text size="xs" color="muted">
            Optional. Add this now to show the last 30 completed days of activity grouped by model.
          </Text>
        </View>
      ) : null}
      {error ? <Text size="sm" color="destructive">{error}</Text> : null}
      <Button onPress={save} disabled={saving || !value.trim()} size="sm">
        {saving ? "Saving..." : copy.button}
      </Button>
    </View>
  );
}

function OpenRouterManagementKeyPanel({
  config,
  onSave,
}: {
  config: ProviderConfig;
  onSave: (config: ProviderConfig) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { providerDataSharingConsent, requestProviderDataSharingConsent } = useAppStore();

  async function save() {
    const managementKey = value.trim();
    if (!managementKey) return;
    if (providerDataSharingConsent !== "granted") {
      requestProviderDataSharingConsent();
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...config, adminKey: managementKey });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginTop: 16, gap: 8 }}>
      <Text size="sm" weight="semibold">
        Add a management key for per-model breakdown
      </Text>
      <Text size="sm" color="muted">
        This optional OpenRouter key unlocks the last 30 completed days of activity grouped by model.
      </Text>
      <input.Input
        value={value}
        onChangeText={setValue}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="OpenRouter management key"
      />
      <Button onPress={save} disabled={saving || !value.trim()} size="sm" style={{ alignSelf: "flex-start" }}>
        {saving ? "Saving..." : "Save management key"}
      </Button>
    </View>
  );
}


function isApiConfigured(providerId: ProviderId, config: ProviderConfig) {
  if (providerId === "kimi" || providerId === "opencode" || providerId === "openrouter") {
    return Boolean(config.apiKey.trim());
  }
  return Boolean(config.adminKey.trim());
}

function apiSetupCopy(providerId: ProviderId) {
  if (providerId === "openai") {
    return { field: "adminKey" as const, title: "Add an OpenAI admin key", body: "Usage and cost reporting needs an organization Admin key (starts with sk-admin-) - standard API keys can't read organization usage, even with 'All' permissions. Create one at platform.openai.com > Settings > Organization > Admin keys.", placeholder: "sk-admin-...", button: "Save admin key" };
  }
  if (providerId === "anthropic") {
    return { field: "adminKey" as const, title: "Add an Anthropic admin key", body: "Usage, cost, and organization rate limits need an Anthropic Admin API key (starts with sk-ant-admin) from console.anthropic.com > Settings > Admin keys.", placeholder: "sk-ant-admin-...", button: "Save admin key" };
  }
  if (providerId === "kimi") {
    return { field: "apiKey" as const, title: "Add a Moonshot API key", body: "Kimi API mode can show live account balance once a Moonshot API key is stored.", placeholder: "Moonshot API key", button: "Save API key" };
  }
  if (providerId === "opencode") {
    return { field: "apiKey" as const, title: "Add an OpenCode Zen API key", body: "Zen is OpenCode's pay-as-you-go API gateway. Model Pulse stores your key but will not send a billable request just to test it. Zen does not currently expose account spend, credits, token counts, or request counts through the public API.", placeholder: "OpenCode Zen API key", button: "Save Zen API key" };
  }
  if (providerId === "openrouter") {
    return { field: "apiKey" as const, title: "Add an OpenRouter API key", body: "A standard OpenRouter API key can report month-to-date usage and any key-level credit cap.", placeholder: "sk-or-v1-...", button: "Save API key" };
  }
  return { field: "adminKey" as const, title: "Add a fal Admin API key", body: "fal Platform APIs require an Admin API key to report model cost and workspace credit balance.", placeholder: "fal admin key", button: "Save admin key" };
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
  hasSubscription: boolean,
  preferredSource: HomeCardSource,
) {
  const subscriptionConnected = subscriptionStatus?.kind === "connected";

  if (subscriptionConnected && apiConfigured && apiSnapshot) {
    // Both sources live: honor the per-card preference.
    return preferredSource === "api"
      ? buildApiSummary(apiSnapshot)
      : buildSubscriptionSummary(subscriptionStatus);
  }

  if (subscriptionConnected) {
    return buildSubscriptionSummary(subscriptionStatus);
  }

  if (apiConfigured && apiSnapshot) {
    return buildApiSummary(apiSnapshot);
  }

  return {
    mode: "empty" as const,
    stats: hasApi && hasSubscription
      ? [
          { label: "Subscription", value: subscriptionSummary(subscriptionStatus) },
          { label: "API", value: apiSnapshot ? apiSnapshot.statusLabel : "Add key" },
        ]
      : hasApi
        ? [
            { label: "API", value: apiSnapshot?.statusLabel ?? "Add key" },
            { label: "Telemetry", value: "Spend & credits" },
          ]
      : [
          { label: "Subscription", value: subscriptionSummary(subscriptionStatus) },
          { label: "Plan", value: "—" },
        ],
    progress: null,
    subscriptionRows: undefined,
  };
}

function buildSubscriptionSummary(status: Extract<ConnectionStatus, { kind: "connected" }>) {
  const primarySub = preferredSubscriptionRow(status.usage);
  const secondarySub = status.usage.limits.find((row) => row.label !== primarySub?.label) ?? null;
  const rows = status.usage.limits;
  return {
    mode: "subscription" as const,
    stats: rows.length > 0 ? [] : [
      { label: shortUsageLabel(primarySub?.label ?? "Current"), value: formatUsageRow(primarySub) },
      { label: shortUsageLabel(secondarySub?.label ?? "Plan"), value: formatUsageRow(secondarySub, status.usage.planLabel ?? "Connected") },
    ],
    progress: rows.length > 0 ? null : subscriptionPercent(primarySub),
    subscriptionRows: rows.length > 0 ? rows : undefined,
  };
}

function buildApiSummary(apiSnapshot: ProviderSnapshot) {
  if (apiSnapshot.usage.spendAvailable === false && apiSnapshot.usage.tokensAvailable === false && apiSnapshot.usage.requestsAvailable === false) {
    return {
      mode: "api" as const,
      stats: [
        { label: "API", value: apiSnapshot.statusLabel },
        { label: "Telemetry", value: "Not reported" },
      ],
      progress: computeApiLimitPercent(apiSnapshot),
      subscriptionRows: undefined,
    };
  }

  const stats = [
    { label: "Monthly spend", value: apiSnapshot.usage.spendAvailable === false ? "Not reported" : `$${apiSnapshot.usage.monthlySpendUsd.toFixed(2)}` },
  ];
  if (apiSnapshot.usage.tokensAvailable !== false) {
    stats.push({ label: "API tokens", value: compactNumber(apiSnapshot.usage.tokensUsed) });
  }
  if (apiSnapshot.balanceLabel) {
    stats.push({ label: "Balance", value: apiSnapshot.balanceLabel });
  } else if (apiSnapshot.usage.requestsAvailable !== false) {
    stats.push({ label: "Requests 24h", value: formatInt(apiSnapshot.usage.requestsUsed) });
  }
  return {
    mode: "api" as const,
    stats,
    progress: computeApiLimitPercent(apiSnapshot),
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
