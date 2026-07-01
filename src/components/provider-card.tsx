import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { Card } from "@/components/ui/card";
import { RateLimitLine } from "@/components/ui/rate-limit-line";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";
import { PROVIDERS } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";
import type { ProviderId, ProviderSnapshot, SnapshotMode } from "@/types/domain";

export function ProviderCard({ providerId }: { providerId: ProviderId }) {
  return (
    <Link href={`/provider/${providerId}`} asChild>
      <Pressable style={{ marginBottom: 12 }}>
        <Card padding={4} border={false}>
          <ProviderPanel providerId={providerId} showHeader />
        </Card>
      </Pressable>
    </Link>
  );
}

export function ProviderPanel({
  providerId,
  showHeader = false,
}: {
  providerId: ProviderId;
  showHeader?: boolean;
}) {
  const theme = useTheme();
  const provider = PROVIDERS[providerId];
  const snapshot = useAppStore().snapshots[providerId];

  return (
    <View>
      {showHeader ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: provider.accent }} />
            <Text size="base" weight="semibold">
              {provider.label}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ModeChip mode={snapshot.mode} />
            <Image source="sf:chevron.right" style={{ width: 12, height: 12, tintColor: theme.mutedForeground }} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text size="xs" weight="bold" color="muted">
            API
          </Text>
          <ModeChip mode={snapshot.mode} />
        </View>
      )}

      <Text size="2xl" weight="bold" style={{ marginTop: 12 }}>
        {snapshot.statusLabel}
      </Text>
      <Text size="sm" color="muted" style={{ marginTop: 4 }} numberOfLines={showHeader ? 2 : 3}>
        {snapshot.note}
      </Text>

      <View style={{ flexDirection: "row", gap: 16, marginTop: 18 }}>
        {snapshot.mode === "live" ? (
          <Stat label="Tokens" value={compact(snapshot.usage.tokensUsed)} style={{ flex: 1 }} />
        ) : null}
        <Stat
          label="Spend"
          value={`$${snapshot.usage.monthlySpendUsd.toFixed(2)}`}
          style={{ flex: snapshot.mode === "live" ? 1 : 2 }}
        />
        <Stat
          label={snapshot.balanceLabel ? "Balance" : "RPM left"}
          value={snapshot.balanceLabel ?? snapshot.limits.requestsRemaining?.toString() ?? "—"}
          style={{ flex: 1 }}
        />
      </View>

      <UtilizationBars snapshot={snapshot} accent={provider.accent} />
    </View>
  );
}

const MODE_DOT: Record<SnapshotMode, string> = {
  demo: "#8E8E93",
  live: "#22C55E",
  manual: "#0A84FF",
  "needs-key": "#F59E0B",
  failed: "#EF4444",
  subscription: "#A855F7",
};

function ModeChip({ mode }: { mode: SnapshotMode }) {
  const theme = useTheme();
  const color = MODE_DOT[mode] ?? MODE_DOT.demo;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: theme.muted,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text size="xs" weight="semibold" style={{ color }}>
        {mode === "needs-key" ? "needs key" : mode}
      </Text>
    </View>
  );
}

function UtilizationBars({
  snapshot,
  accent,
}: {
  snapshot: ProviderSnapshot;
  accent: string;
}) {
  const rpmPercent = computeRpmPercent(snapshot);
  const tpmPercent = computeTpmPercent(snapshot);
  if (rpmPercent === null && tpmPercent === null) return null;

  return (
    <View style={{ gap: 10, marginTop: 16 }}>
      {rpmPercent !== null && <UsageBar label="Requests / min" percent={rpmPercent} accent={accent} />}
      {tpmPercent !== null && <UsageBar label="Tokens / min" percent={tpmPercent} accent={accent} />}
    </View>
  );
}

function UsageBar({
  label,
  percent,
  accent,
}: {
  label: string;
  percent: number;
  accent: string;
}) {
  const clamped = Math.max(0, Math.min(percent, 1));

  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text size="xs" weight="medium" color="muted">
          {label}
        </Text>
        <Text size="xs" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
          {Math.round(clamped * 100)}%
        </Text>
      </View>
      <RateLimitLine value={clamped} color={accent} style={{ height: 5 }} />
    </View>
  );
}

function computeRpmPercent(snapshot: ProviderSnapshot): number | null {
  const limit = snapshot.limits.requestsPerMinuteLimit;
  const remaining = snapshot.limits.requestsRemaining;
  if (typeof limit !== "number" || limit <= 0) return null;
  if (typeof remaining === "number") return Math.max(0, remaining) / limit;
  return Math.max(0, 1 - snapshot.usage.requestsUsed / limit);
}

function computeTpmPercent(snapshot: ProviderSnapshot): number | null {
  const limit = snapshot.limits.tokensPerMinuteLimit;
  if (typeof limit !== "number" || limit <= 0) return null;
  return Math.max(0, 1 - snapshot.usage.tokensUsed / limit);
}

function Stat({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: { flex?: number };
}) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <Text size="xs" weight="medium" color="muted">
        {label}
      </Text>
      <Text
              size="lg"
              family="sans"
              weight="bold"
              style={{ marginTop: 3, fontVariant: ["tabular-nums"] }}
            >
        {value}
      </Text>
    </View>
  );
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}
