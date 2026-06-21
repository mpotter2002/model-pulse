import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProviderCard } from "@/components/provider-card";
import { PROVIDER_ORDER } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { snapshots, theme, demoMode, refreshing, refreshAll } = useAppStore();
  const totalMonthlySpend = PROVIDER_ORDER.reduce((sum, id) => sum + snapshots[id].usage.monthlySpendUsd, 0);
  const totalTokens = PROVIDER_ORDER.reduce((sum, id) => sum + snapshots[id].usage.tokensUsed, 0);
  const modes = PROVIDER_ORDER.map((id) => snapshots[id].mode);
  const liveCount = modes.filter((m) => m === "live").length;
  const failedCount = modes.filter((m) => m === "failed").length;
  const needsKeyCount = modes.filter((m) => m === "needs-key").length;

  const statusLabel = demoMode
    ? "Demo"
    : failedCount > 0
      ? `${failedCount} failed`
      : liveCount === PROVIDER_ORDER.length
        ? "All live"
        : liveCount > 0
          ? `${liveCount}/${PROVIDER_ORDER.length} live`
          : needsKeyCount > 0
            ? "Add keys"
            : "Ready";

  const statusColor =
    failedCount > 0 ? "#EF4444" : demoMode ? "#F59E0B" : liveCount === PROVIDER_ORDER.length ? "#10B981" : "#8E8E93";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.text}
          onRefresh={() => {
            Haptics.selectionAsync();
            void refreshAll();
          }}
        />
      }
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Title */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>SignalStack</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
            <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "600" }}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>AI subscription telemetry</Text>

        {/* Summary stats */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
          <View style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: theme.subtlePanel }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>Monthly spend</Text>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800", marginTop: 4, fontVariant: ["tabular-nums"] }}>
              ${totalMonthlySpend.toFixed(2)}
            </Text>
          </View>
          <View style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: theme.subtlePanel }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>Tracked tokens</Text>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800", marginTop: 4, fontVariant: ["tabular-nums"] }}>
              {compactNumber(totalTokens)}
            </Text>
          </View>
        </View>

        {/* Failure banner */}
        {failedCount > 0 ? (
          <View style={{ marginTop: 20, gap: 4, borderRadius: 14, padding: 14, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}>
            <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "700" }}>
              {failedCount} refresh issue{failedCount === 1 ? "" : "s"}
            </Text>
            <Text style={{ color: "#991B1B", fontSize: 13, lineHeight: 18 }}>
              {PROVIDER_ORDER.filter((id) => snapshots[id].mode === "failed")
                .map((id) => snapshots[id].lastError ?? "Unknown error")
                .join(" · ")}
            </Text>
          </View>
        ) : null}

        {/* Providers */}
        <View style={{ marginTop: 28 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>Providers</Text>
            <Link href="/settings" asChild>
              <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.subtlePanel }}>
                <Image source="sf:slider.horizontal.3" style={{ width: 14, height: 14, tintColor: theme.text }} />
                <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>Connections</Text>
              </Pressable>
            </Link>
          </View>

          {PROVIDER_ORDER.map((id) => (
            <ProviderCard key={id} providerId={id} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}
