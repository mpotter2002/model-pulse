import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { PROVIDERS } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";
import type { ProviderId, ProviderSnapshot, SnapshotMode } from "@/types/domain";

export function ProviderCard({ providerId }: { providerId: ProviderId }) {
  const { snapshots, theme } = useAppStore();
  const provider = PROVIDERS[providerId];
  const snapshot = snapshots[providerId];

  return (
    <Link href={`/provider/${providerId}`} asChild>
      <Pressable
        style={{
          backgroundColor: theme.panel,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 20,
          marginBottom: 12,
        }}
      >
        {/* Top row: dot + name + mode + chevron */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: provider.accent }} />
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>
              {provider.label}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ModeDot mode={snapshot.mode} />
            <Image source="sf:chevron.right" style={{ width: 12, height: 12, tintColor: theme.muted }} />
          </View>
        </View>

        {/* Status */}
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800", marginTop: 8 }}>
          {snapshot.statusLabel}
        </Text>

        {/* Note */}
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
          {snapshot.note}
        </Text>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 16, marginTop: 16 }}>
          <Stat label="Tokens" value={compact(snapshot.usage.tokensUsed)} theme={theme} />
          <Stat label="Spend" value={`$${snapshot.usage.monthlySpendUsd.toFixed(2)}`} theme={theme} />
          <Stat
            label={snapshot.balanceLabel ? "Balance" : "RPM left"}
            value={snapshot.balanceLabel ?? snapshot.limits.requestsRemaining?.toString() ?? "?"}
            theme={theme}
          />
        </View>

        <UtilizationBars snapshot={snapshot} accent={provider.accent} theme={theme} />
      </Pressable>
    </Link>
  );
}

const MODE_DOT: Record<SnapshotMode, string> = {
  demo: "#8E8E93",
  live: "#10B981",
  manual: "#3B82F6",
  "needs-key": "#F59E0B",
  failed: "#EF4444",
  subscription: "#A855F7",
};

function ModeDot({ mode }: { mode: SnapshotMode }) {
  const color = MODE_DOT[mode] ?? MODE_DOT.demo;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
        {mode === "needs-key" ? "needs key" : mode}
      </Text>
    </View>
  );
}

function UtilizationBars({
  snapshot,
  accent,
  theme,
}: {
  snapshot: ProviderSnapshot;
  accent: string;
  theme: ReturnType<typeof useAppStore>["theme"];
}) {
  const rpmPercent = computeRpmPercent(snapshot);
  const tpmPercent = computeTpmPercent(snapshot);
  if (rpmPercent === null && tpmPercent === null) return null;

  return (
    <View style={{ gap: 8, marginTop: 14 }}>
      {rpmPercent !== null && <UsageBar label="Requests / min" percent={rpmPercent} accent={accent} theme={theme} />}
      {tpmPercent !== null && <UsageBar label="Tokens / min" percent={tpmPercent} accent={accent} theme={theme} />}
    </View>
  );
}

function UsageBar({
  label,
  percent,
  accent,
  theme,
}: {
  label: string;
  percent: number;
  accent: string;
  theme: ReturnType<typeof useAppStore>["theme"];
}) {
  const clamped = Math.max(0, Math.min(percent, 1));
  const color = clamped >= 0.9 ? "#EF4444" : clamped >= 0.7 ? "#F59E0B" : accent;

  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: theme.text, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {Math.round(clamped * 100)}%
        </Text>
      </View>
      <View style={{ height: 3, borderRadius: 1.5, backgroundColor: theme.subtlePanel, overflow: "hidden" }}>
        <View style={{ width: `${clamped * 100}%`, height: "100%", backgroundColor: color, borderRadius: 1.5 }} />
      </View>
    </View>
  );
}

function computeRpmPercent(snapshot: ProviderSnapshot): number | null {
  const limit = snapshot.limits.requestsPerMinuteLimit;
  const remaining = snapshot.limits.requestsRemaining;
  if (typeof limit !== "number" || limit <= 0) return null;
  if (typeof remaining === "number") return (limit - Math.max(0, remaining)) / limit;
  if (snapshot.usage.requestsUsed > 0) return Math.min(snapshot.usage.requestsUsed / limit, 1);
  return null;
}

function computeTpmPercent(snapshot: ProviderSnapshot): number | null {
  const limit = snapshot.limits.tokensPerMinuteLimit;
  if (typeof limit !== "number" || limit <= 0) return null;
  if (snapshot.usage.tokensUsed > 0) return Math.min(snapshot.usage.tokensUsed / limit, 1);
  return null;
}

function Stat({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useAppStore>["theme"];
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: "800", marginTop: 2, fontVariant: ["tabular-nums"] }}>
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
