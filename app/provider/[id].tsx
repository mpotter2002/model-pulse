import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PROVIDERS } from "@/lib/providers";
import { shadowProps } from "@/lib/theme";
import { useAppStore } from "@/store/app-store";
import type { ProviderId } from "@/types/domain";

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { snapshots, providerConfigs, theme, refreshProvider } = useAppStore();

  if (!isProviderId(id)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background, padding: 24 }}>
        <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
          Provider not found
        </Text>
      </View>
    );
  }

  const provider = PROVIDERS[id];
  const snapshot = snapshots[id];
  const config = providerConfigs[id];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View
        style={{
          gap: 12,
          borderRadius: 28,
          padding: 20,
          backgroundColor: theme.panel,
          borderWidth: 1,
          borderColor: theme.border,
          ...shadowProps("#000000", 0.06),
        }}
      >
        <View style={{ gap: 6 }}>
          <Text selectable style={{ color: provider.accent, fontSize: 13, fontWeight: "700", letterSpacing: 0.4 }}>
            {provider.label.toUpperCase()}
          </Text>
          <Text selectable style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>
            {snapshot.statusLabel}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21 }}>
            {snapshot.note}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            void refreshProvider(id);
          }}
          style={{
            alignSelf: "flex-start",
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 11,
            backgroundColor: provider.accent,
          }}
        >
          <Text selectable style={{ color: "#061014", fontWeight: "800" }}>
            Refresh now
          </Text>
        </Pressable>
      </View>

      {snapshot.lastError ? (
        <View
          style={{
            gap: 6,
            borderRadius: 20,
            padding: 16,
            backgroundColor: "#F8DAD7",
            borderWidth: 1,
            borderColor: "#E2A8A2",
          }}
        >
          <Text style={{ color: "#7A1F1A", fontSize: 13, fontWeight: "800", letterSpacing: 0.4 }}>
            LAST ERROR
          </Text>
          <Text selectable style={{ color: "#5C1714", fontSize: 14, lineHeight: 19 }}>
            {snapshot.lastError}
          </Text>
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
        gap: 12,
        borderRadius: 24,
        padding: 18,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.border,
        ...shadowProps("#000000", 0.06),
      }}
    >
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
        {title}
      </Text>
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text selectable style={{ flex: 1, color: theme.muted, fontSize: 15 }}>
            {label}
          </Text>
          <Text
            selectable
            style={{ color: theme.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "right" }}
          >
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
