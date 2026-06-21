import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { PROVIDERS } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";
import type { ProviderId, SnapshotMode } from "@/types/domain";

export function ProviderCard({ providerId }: { providerId: ProviderId }) {
  const { snapshots, theme } = useAppStore();
  const provider = PROVIDERS[providerId];
  const snapshot = snapshots[providerId];

  return (
    <Link href={`/provider/${providerId}`} asChild>
      <Pressable
        style={{
          gap: 14,
          borderRadius: 24,
          padding: 18,
          backgroundColor: theme.panel,
          borderWidth: 1,
          borderColor: theme.border,
          boxShadow: theme.shadow,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text selectable style={{ color: provider.accent, fontSize: 13, fontWeight: "800", letterSpacing: 0.4 }}>
                {provider.label.toUpperCase()}
              </Text>
              <ModeBadge mode={snapshot.mode} />
            </View>
            <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>
              {snapshot.statusLabel}
            </Text>
          </View>
          <Image source="sf:chevron.right" style={{ width: 15, height: 15, tintColor: theme.muted }} />
        </View>

        <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
          {snapshot.note}
        </Text>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Stat label="Tokens" value={compact(snapshot.usage.tokensUsed)} theme={theme} />
          <Stat label="Spend" value={`$${snapshot.usage.monthlySpendUsd.toFixed(2)}`} theme={theme} />
          <Stat
            label={snapshot.balanceLabel ? "Balance" : "RPM left"}
            value={snapshot.balanceLabel ?? snapshot.limits.requestsRemaining?.toString() ?? "?"}
            theme={theme}
          />
        </View>
      </Pressable>
    </Link>
  );
}

const MODE_STYLE: Record<SnapshotMode, { label: string; bg: string; fg: string }> = {
  demo: { label: "DEMO", bg: "#E8E0D0", fg: "#6E6255" },
  live: { label: "LIVE", bg: "#CFEFD9", fg: "#1F6B3A" },
  manual: { label: "MANUAL", bg: "#E1E7F2", fg: "#3F5375" },
  "needs-key": { label: "NEEDS KEY", bg: "#FCE6C3", fg: "#7A4A11" },
  failed: { label: "FAILED", bg: "#F3C9C7", fg: "#7A1F1A" },
};

function ModeBadge({ mode }: { mode: SnapshotMode }) {
  const style = MODE_STYLE[mode] ?? MODE_STYLE.demo;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: style.bg,
      }}
    >
      <Text style={{ color: style.fg, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>
        {style.label}
      </Text>
    </View>
  );
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
    <View style={{ flex: 1, gap: 4, borderRadius: 18, padding: 12, backgroundColor: theme.subtlePanel }}>
      <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
        {label}
      </Text>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
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
