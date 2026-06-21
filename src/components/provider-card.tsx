import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { PROVIDERS } from "@/lib/providers";
import { shadowProps } from "@/lib/theme";
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
          flexDirection: "row",
          borderRadius: 20,
          backgroundColor: theme.panel,
          overflow: "hidden",
          ...shadowProps("#000000", 0.05),
        }}
      >
        {/* Left accent strip */}
        <View style={{ width: 4, backgroundColor: provider.accent }} />

        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          {/* Header row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: provider.accent }} />
              <Text style={{ color: provider.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 }}>
                {provider.label.toUpperCase()}
              </Text>
            </View>
            <ModeBadge mode={snapshot.mode} />
          </View>

          {/* Status */}
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>
            {snapshot.statusLabel}
          </Text>

          <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
            {snapshot.note}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Stat label="Tokens" value={compact(snapshot.usage.tokensUsed)} theme={theme} />
            <Stat label="Spend" value={`$${snapshot.usage.monthlySpendUsd.toFixed(2)}`} theme={theme} />
            <Stat
              label={snapshot.balanceLabel ? "Balance" : "RPM left"}
              value={snapshot.balanceLabel ?? snapshot.limits.requestsRemaining?.toString() ?? "?"}
              theme={theme}
            />
          </View>

          <UtilizationBars snapshot={snapshot} accent={provider.accent} theme={theme} />
        </View>

        <View style={{ justifyContent: "center", paddingRight: 12 }}>
          <Image source="sf:chevron.right" style={{ width: 14, height: 14, tintColor: theme.muted }} />
        </View>
      </Pressable>
    </Link>
  );
}

const MODE_STYLE: Record<SnapshotMode, { label: string; bg: string; fg: string }> = {
  demo: { label: "DEMO", bg: "#FEF3C7", fg: "#92400E" },
  live: { label: "LIVE", bg: "#D1FAE5", fg: "#065F46" },
  manual: { label: "MANUAL", bg: "#DBEAFE", fg: "#1E40AF" },
  "needs-key": { label: "NEEDS KEY", bg: "#FED7AA", fg: "#9A3412" },
  failed: { label: "FAILED", bg: "#FEE2E2", fg: "#991B1B" },
};

function ModeBadge({ mode }: { mode: SnapshotMode }) {
  const style = MODE_STYLE[mode] ?? MODE_STYLE.demo;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: style.bg }}>
      <Text style={{ color: style.fg, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 }}>
        {style.label}
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
    <View style={{ gap: 8 }}>
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
      <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.subtlePanel, overflow: "hidden" }}>
        <View style={{ width: `${clamped * 100}%`, height: "100%", backgroundColor: color, borderRadius: 2 }} />
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
    <View style={{ flex: 1, gap: 2, borderRadius: 12, padding: 10, backgroundColor: theme.subtlePanel }}>
      <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
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
