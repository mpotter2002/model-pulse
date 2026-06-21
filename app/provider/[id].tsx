import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PROVIDERS } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";
import type { ProviderId } from "@/types/domain";

export default function ProviderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { snapshots, providerConfigs, theme, refreshProvider } = useAppStore();

  if (!isProviderId(id)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background, padding: 24 }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>Provider not found</Text>
      </View>
    );
  }

  const provider = PROVIDERS[id];
  const snapshot = snapshots[id];
  const config = providerConfigs[id];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      {/* Title */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: provider.accent }} />
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>{provider.label}</Text>
      </View>

      {/* Status card */}
      <View
        style={{
          marginTop: 20,
          gap: 12,
          borderRadius: 16,
          padding: 20,
          backgroundColor: theme.panel,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: "800" }}>{snapshot.statusLabel}</Text>
          <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>{snapshot.note}</Text>
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            void refreshProvider(id);
          }}
          style={{
            alignSelf: "flex-start",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: theme.subtlePanel,
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 13 }}>Refresh now</Text>
        </Pressable>
      </View>

      {snapshot.lastError ? (
        <View
          style={{
            marginTop: 16,
            gap: 6,
            borderRadius: 16,
            padding: 16,
            backgroundColor: "#FEF2F2",
            borderWidth: 1,
            borderColor: "#FECACA",
          }}
        >
          <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "800" }}>LAST ERROR</Text>
          <Text style={{ color: "#991B1B", fontSize: 14, lineHeight: 19 }}>{snapshot.lastError}</Text>
        </View>
      ) : null}

      <MetricBlock
        title="Usage"
        rows={[
          ["Tokens tracked", formatInteger(snapshot.usage.tokensUsed)],
          ["Requests tracked", formatInteger(snapshot.usage.requestsUsed)],
          ["Monthly spend", `$${snapshot.usage.monthlySpendUsd.toFixed(2)}`],
          ["Window", snapshot.usage.windowLabel],
        ]}
        theme={theme}
      />

      <MetricBlock
        title="Limits"
        rows={[
          ["Requests / min", formatLimit(snapshot.limits.requestsPerMinuteLimit)],
          ["Requests remaining", formatLimit(snapshot.limits.requestsRemaining)],
          ["Tokens / min", formatLimit(snapshot.limits.tokensPerMinuteLimit)],
          ["Reset", snapshot.limits.resetsAtLabel ?? "Unknown"],
        ]}
        theme={theme}
      />

      <MetricBlock
        title="Connection"
        rows={[
          ["Mode", config.mode],
          ["API key", config.apiKey ? "Stored" : "Missing"],
          ["Admin key", config.adminKey ? "Stored" : "Missing"],
          ["Balance", snapshot.balanceLabel ?? "Not exposed"],
          ["Last updated", snapshot.updatedAtLabel],
        ]}
        theme={theme}
      />
    </ScrollView>
  );
}

function isProviderId(value: string | undefined): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "kimi";
}

function MetricBlock({
  title,
  rows,
  theme,
}: {
  title: string;
  rows: [string, string][];
  theme: {
    panel: string;
    border: string;
    text: string;
    muted: string;
  };
}) {
  return (
    <View
      style={{
        marginTop: 16,
        gap: 12,
        borderRadius: 16,
        padding: 18,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ flex: 1, color: theme.muted, fontSize: 14 }}>{label}</Text>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "right" }}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatLimit(value: number | null) {
  if (value === null) return "Unknown";
  return formatInteger(value);
}
