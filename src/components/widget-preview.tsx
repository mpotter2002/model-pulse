import React from "react";
import { Text, View } from "react-native";

import { PROVIDER_ORDER, PROVIDERS } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";

export function WidgetPreview() {
  const { snapshots, theme } = useAppStore();

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {PROVIDER_ORDER.map((providerId) => {
          const provider = PROVIDERS[providerId];
          const snapshot = snapshots[providerId];

          return (
            <View
              key={providerId}
              style={{
                flex: 1,
                gap: 6,
                borderRadius: 22,
                padding: 14,
                backgroundColor: "#101519",
                borderWidth: 1,
                borderColor: "#202B31",
              }}
            >
              <Text selectable style={{ color: provider.accent, fontSize: 11, fontWeight: "800" }}>
                {provider.label.split(" / ")[0]}
              </Text>
              <Text selectable style={{ color: "#F5F7F8", fontSize: 18, fontWeight: "800", lineHeight: 20 }}>
                {snapshot.statusLabel}
              </Text>
              <Text selectable style={{ color: "#90A1AC", fontSize: 12, fontVariant: ["tabular-nums"] }}>
                {snapshot.limits.requestsRemaining?.toString() ?? "?"} RPM left
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={{
          gap: 10,
          borderRadius: 24,
          padding: 16,
          backgroundColor: theme.panel,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: "800" }}>
          Medium widget concept
        </Text>
        {PROVIDER_ORDER.map((providerId) => {
          const provider = PROVIDERS[providerId];
          const snapshot = snapshots[providerId];
          return (
            <View key={providerId} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text selectable style={{ color: theme.text, fontWeight: "700" }}>
                {provider.label.split(" / ")[0]}
              </Text>
              <Text selectable style={{ color: theme.muted, fontVariant: ["tabular-nums"] }}>
                ${snapshot.usage.monthlySpendUsd.toFixed(2)} | {snapshot.usage.windowLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
