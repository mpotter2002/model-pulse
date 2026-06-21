import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { ProviderCard } from "@/components/provider-card";
import { PROVIDER_ORDER } from "@/lib/providers";
import { shadowProps } from "@/lib/theme";
import { useAppStore } from "@/store/app-store";

export default function HomeScreen() {
  const { snapshots, theme, demoMode, refreshing, refreshAll } = useAppStore();
  const totalMonthlySpend = PROVIDER_ORDER.reduce((sum, id) => sum + snapshots[id].usage.monthlySpendUsd, 0);
  const totalTokens = PROVIDER_ORDER.reduce((sum, id) => sum + snapshots[id].usage.tokensUsed, 0);
  const modes = PROVIDER_ORDER.map((id) => snapshots[id].mode);
  const liveCount = modes.filter((m) => m === "live").length;
  const failedCount = modes.filter((m) => m === "failed").length;
  const needsKeyCount = modes.filter((m) => m === "needs-key").length;
  const statusLabel = demoMode
    ? "DEMO"
    : failedCount > 0
      ? `${failedCount} FAILED`
      : liveCount === PROVIDER_ORDER.length
        ? "ALL LIVE"
        : liveCount > 0
          ? `${liveCount}/${PROVIDER_ORDER.length} LIVE`
          : needsKeyCount > 0
            ? "ADD KEYS"
            : "READY";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 32 }}
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
      {/* Gradient Header */}
      <LinearGradient
        colors={demoMode ? ["#1E293B", "#334155"] : ["#0F172A", "#1E293B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}>
            SIGNALSTACK
          </Text>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: demoMode ? "rgba(251, 191, 36, 0.15)" : "rgba(52, 211, 153, 0.15)" }}>
            <Text style={{ color: demoMode ? "#FBBF24" : "#34D399", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text style={{ color: "#F1F5F9", fontSize: 26, fontWeight: "800", lineHeight: 32, marginBottom: 20 }}>
          One screen for usage, limits, and burn.
        </Text>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 4, borderRadius: 16, padding: 14, backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "600" }}>Monthly spend</Text>
            <Text style={{ color: "#F1F5F9", fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
              ${totalMonthlySpend.toFixed(2)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4, borderRadius: 16, padding: 14, backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "600" }}>Tracked tokens</Text>
            <Text style={{ color: "#F1F5F9", fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
              {compactNumber(totalTokens)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: 20, gap: 16 }}>
        {failedCount > 0 ? (
          <View style={{ gap: 4, borderRadius: 16, padding: 14, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}>
            <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 }}>
              {failedCount} REFRESH ISSUE{failedCount === 1 ? "" : "S"}
            </Text>
            <Text style={{ color: "#991B1B", fontSize: 13, lineHeight: 18 }}>
              {PROVIDER_ORDER.filter((id) => snapshots[id].mode === "failed")
                .map((id) => snapshots[id].lastError ?? "Unknown error")
                .join(" · ")}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>Providers</Text>
          <Link href="/settings" asChild>
            <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.subtlePanel }}>
              <Image source="sf:slider.horizontal.3" style={{ width: 14, height: 14, tintColor: theme.text }} />
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>Connections</Text>
            </Pressable>
          </Link>
        </View>

        {PROVIDER_ORDER.map((id) => (
          <ProviderCard key={id} providerId={id} />
        ))}
      </View>
    </ScrollView>
  );
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}
