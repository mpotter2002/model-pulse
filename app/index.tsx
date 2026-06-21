import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { ProviderCard } from "@/components/provider-card";
import { WidgetPreview } from "@/components/widget-preview";
import { PROVIDER_ORDER } from "@/lib/providers";
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
    ? "DEMO MODE"
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
      contentContainerStyle={{ padding: 20, gap: 18 }}
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
      <View
        style={{
          gap: 14,
          borderRadius: 28,
          padding: 20,
          backgroundColor: theme.panel,
          borderWidth: 1,
          borderColor: theme.border,
          boxShadow: theme.shadow,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "600", letterSpacing: 0.4 }}>
              AI SUBSCRIPTION TELEMETRY
            </Text>
            <Text selectable style={{ color: theme.text, fontSize: 30, fontWeight: "800", lineHeight: 34 }}>
              One screen for usage, limits, and burn.
            </Text>
          </View>
          <BlurView
            intensity={demoMode ? 28 : 40}
            tint={theme.blurTint}
            style={{
              minWidth: 92,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.border,
              overflow: "hidden",
            }}
          >
            <Text selectable style={{ color: theme.text, fontSize: 11, fontWeight: "700", textAlign: "center" }}>
              {statusLabel}
            </Text>
          </BlurView>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <MetricChip label="Monthly spend" value={`$${totalMonthlySpend.toFixed(2)}`} theme={theme} />
          <MetricChip label="Tracked tokens" value={compactNumber(totalTokens)} theme={theme} />
        </View>

        <View
          style={{
            gap: 12,
            borderRadius: 24,
            padding: 14,
            backgroundColor: theme.subtlePanel,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
            Widget wall
          </Text>
          <WidgetPreview />
        </View>
      </View>

      {failedCount > 0 ? (
        <View
          style={{
            gap: 4,
            borderRadius: 20,
            padding: 14,
            backgroundColor: "#F8DAD7",
            borderWidth: 1,
            borderColor: "#E2A8A2",
          }}
        >
          <Text style={{ color: "#7A1F1A", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 }}>
            {failedCount} REFRESH ISSUE{failedCount === 1 ? "" : "S"}
          </Text>
          <Text style={{ color: "#5C1714", fontSize: 13, lineHeight: 18 }}>
            {PROVIDER_ORDER.filter((id) => snapshots[id].mode === "failed")
              .map((id) => snapshots[id].lastError ?? "Unknown error")
              .join(" · ")}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>
            Providers
          </Text>
          <Link href="/settings" asChild>
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: theme.panel,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Image source="sf:slider.horizontal.3" style={{ width: 16, height: 16, tintColor: theme.text }} />
              <Text selectable style={{ color: theme.text, fontWeight: "700" }}>
                Connections
              </Text>
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

function MetricChip({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: {
    chip: string;
    text: string;
    muted: string;
  };
}) {
  return (
    <View style={{ flex: 1, gap: 4, borderRadius: 20, padding: 14, backgroundColor: theme.chip }}>
      <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
      <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}
