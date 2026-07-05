import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScreenScrollView } from "@/components/ui/screen";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";
import { PROVIDERS } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";
import type { ProviderConfig, ProviderId } from "@/types/domain";
import { radius, spacing } from "@/design-system/tokens";

export default function ProviderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { snapshots, providerConfigs, refreshProvider, saveProviderConfig } = useAppStore();
  const theme = useTheme();
  const [draft, setDraft] = useState<ProviderConfig | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const providerId: ProviderId = isProviderId(id) ? id : "openai";
  const provider = PROVIDERS[providerId];
  const snapshot = snapshots[providerId];
  const config = providerConfigs[providerId];
  const currentDraft = draft ?? config;
  const hasChanges = useMemo(
    () => JSON.stringify(currentDraft) !== JSON.stringify(config),
    [currentDraft, config],
  );

  useEffect(() => {
    setDraft(config);
  }, [config]);

  if (!isProviderId(id)) {
    return (
      <ScreenScrollView contentContainerStyle={{ paddingTop: insets.top + 96 }}>
        <Card padding={5} style={{ alignItems: "center" }}>
          <Text size="xl" weight="bold" style={{ marginBottom: 6 }}>
            Provider not found
          </Text>
          <Text size="sm" color="muted" style={{ textAlign: "center" }}>
            This provider may have been removed or renamed.
          </Text>
        </Card>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ paddingTop: insets.top + 96 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: provider.accent }} />
        <Text size="2xl" weight="extrabold">
          {provider.label}
        </Text>
      </View>

      {/* Status card */}
      <Card padding={5} style={{ marginBottom: 16 }}>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text size="2xl" weight="bold">
              {snapshot.statusLabel}
            </Text>
            <Text size="sm" color="muted">
              {snapshot.note}
            </Text>
          </View>

          <Button
            variant="secondary"
            size="sm"
            style={{ alignSelf: "flex-start" }}
            onPress={() => {
              Haptics.selectionAsync();
              void refreshProvider(providerId);
            }}
          >
            Refresh now
          </Button>
        </View>
      </Card>

      {snapshot.lastError ? (
        <View
          style={{
            marginBottom: 16,
            gap: 6,
            borderRadius: radius.md,
            padding: spacing[4],
            backgroundColor: `${theme.destructive}15`,
            borderWidth: 1,
            borderColor: `${theme.destructive}30`,
          }}
        >
          <Text size="xs" weight="bold" color="destructive">
            LAST ERROR
          </Text>
          <Text size="sm" color="destructive">
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
          ...(snapshot.monthlyBudgetUsd
            ? ([["Budget used", budgetUsedLabel(snapshot.usage.monthlySpendUsd, snapshot.monthlyBudgetUsd)]] as [string, string][])
            : []),
          ["Window", snapshot.usage.windowLabel],
        ]}
      />

      <MetricBlock
        title="Limits"
        rows={[
          ["Requests / min", formatLimit(snapshot.limits.requestsPerMinuteLimit)],
          ["Requests remaining", formatLimit(snapshot.limits.requestsRemaining)],
          ["Tokens / min", formatLimit(snapshot.limits.tokensPerMinuteLimit)],
          ["Reset", snapshot.limits.resetsAtLabel ?? "Unknown"],
        ]}
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
      />

      <Card padding={5} style={{ marginBottom: 8 }}>
        <View style={{ gap: 14 }}>
          <View>
            <Text size="lg" weight="semibold">
              Advanced API settings
            </Text>
            <Text size="sm" color="muted" style={{ marginTop: 4 }}>
              These fields power the API side of the model card. Subscription auth stays on the model detail screen.
            </Text>
          </View>

          <LabeledInput label="Mode" value={currentDraft.mode} onChangeText={(value) => updateDraft({ mode: value })} />
          <LabeledInput label="API key" value={currentDraft.apiKey} secure onChangeText={(value) => updateDraft({ apiKey: value })} />
          <LabeledInput label="Admin key" value={currentDraft.adminKey} secure onChangeText={(value) => updateDraft({ adminKey: value })} />
          <LabeledInput label="Workspace / org / project" value={currentDraft.workspaceId} onChangeText={(value) => updateDraft({ workspaceId: value })} />
          <LabeledInput label="Requests per minute" value={currentDraft.requestsPerMinuteLimit} keyboardType="number-pad" onChangeText={(value) => updateDraft({ requestsPerMinuteLimit: value })} />
          <LabeledInput label="Tokens per minute" value={currentDraft.tokensPerMinuteLimit} keyboardType="number-pad" onChangeText={(value) => updateDraft({ tokensPerMinuteLimit: value })} />
          <LabeledInput label="Monthly budget (USD)" value={currentDraft.monthlyBudgetUsd} keyboardType="number-pad" onChangeText={(value) => updateDraft({ monthlyBudgetUsd: value })} />

          <Button
            onPress={() => {
              void saveAdvancedSettings();
            }}
            disabled={!hasChanges || saveState === "saving"}
            size="sm"
          >
            {saveState === "saving" ? "Saving..." : "Save API settings"}
          </Button>

          {saveState === "saved" ? (
            <Text size="sm" weight="semibold" color="success">
              Saved.
            </Text>
          ) : null}
          {saveState === "error" ? (
            <Text size="sm" weight="semibold" color="destructive">
              Could not save settings.
            </Text>
          ) : null}
        </View>
      </Card>
    </ScreenScrollView>
  );

  function updateDraft(next: Partial<ProviderConfig>) {
    setDraft((current) => ({ ...(current ?? config), ...next }));
    setSaveState("idle");
  }

  async function saveAdvancedSettings() {
    setSaveState("saving");
    try {
      await saveProviderConfig(providerId, currentDraft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveState("saved");
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaveState("error");
    }
  }
}

function isProviderId(value: string | undefined): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "kimi";
}

function MetricBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <Card padding={4} style={{ marginBottom: 16 }}>
      <View style={{ gap: 12 }}>
        <Text size="lg" weight="semibold">
          {title}
        </Text>
        <Separator style={{ marginVertical: 0 }} />
        <View style={{ gap: 10 }}>
          {rows.map(([label, value]) => (
            <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text size="sm" color="muted" style={{ flex: 1 }}>
                {label}
              </Text>
              <Text size="sm" weight="semibold" style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

function budgetUsedLabel(spend: number, budget: number) {
  const pct = Math.round((spend / budget) * 100);
  return `${pct}% of $${budget.toFixed(0)}`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatLimit(value: number | null) {
  if (value === null) return "Unknown";
  return formatInteger(value);
}

function LabeledInput({
  label,
  value,
  onChangeText,
  secure,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text size="xs" weight="medium" color="muted">
        {label}
      </Text>
      <Input
        value={value}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
      />
    </View>
  );
}
