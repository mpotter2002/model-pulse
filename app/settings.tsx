import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { buildSnapshot } from "@/lib/provider-clients";
import { PROVIDER_ORDER, PROVIDERS } from "@/lib/providers";
import { shadowProps } from "@/lib/theme";
import { useAppStore } from "@/store/app-store";
import type { ProviderConfig, ProviderId } from "@/types/domain";

type TestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export default function SettingsScreen() {
  const { providerConfigs, demoMode, setDemoMode, saveProviderConfig, theme } = useAppStore();
  const [drafts, setDrafts] = useState(providerConfigs);
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "ok" | "error"; message?: string }>({ status: "idle" });

  useEffect(() => {
    setDrafts(providerConfigs);
  }, [providerConfigs]);

  const hasChanges = useMemo(
    () => JSON.stringify(drafts) !== JSON.stringify(providerConfigs),
    [drafts, providerConfigs],
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View
        style={{
          gap: 10,
          borderRadius: 20,
          padding: 18,
          backgroundColor: theme.panel,
          ...shadowProps("#000000", 0.05),
        }}
      >
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>Prototype mode</Text>
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>
          Leave demo mode on while the connectors are still being wired. Turn it off to favor live provider fetches when credentials exist.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}>Demo overlays</Text>
          <Switch
            value={demoMode}
            onValueChange={async (value) => {
              Haptics.selectionAsync();
              try {
                await setDemoMode(value);
              } catch (error) {
                setSaveState({
                  status: "error",
                  message: error instanceof Error ? error.message : "Could not toggle demo mode",
                });
              }
            }}
          />
        </View>
      </View>

      {PROVIDER_ORDER.map((providerId) => (
        <ProviderConfigForm
          key={providerId}
          providerId={providerId}
          draft={drafts[providerId]}
          theme={theme}
          onChange={(next) => {
            setDrafts((current) => ({
              ...current,
              [providerId]: next,
            }));
          }}
        />
      ))}

      <Pressable
        disabled={!hasChanges || saveState.status === "saving"}
        onPress={async () => {
          setSaveState({ status: "saving" });
          try {
            for (const providerId of PROVIDER_ORDER) {
              await saveProviderConfig(providerId, drafts[providerId]);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSaveState({ status: "ok", message: "Saved to secure storage." });
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setSaveState({
              status: "error",
              message: error instanceof Error ? error.message : "Unknown save error",
            });
          }
        }}
        style={{
          borderRadius: 16,
          paddingVertical: 14,
          alignItems: "center",
          backgroundColor: hasChanges ? theme.action : theme.chip,
          opacity: saveState.status === "saving" ? 0.6 : 1,
        }}
      >
        <Text style={{ color: hasChanges ? "#FFFFFF" : theme.muted, fontSize: 15, fontWeight: "800" }}>
          {saveState.status === "saving" ? "Saving…" : "Save connections"}
        </Text>
      </Pressable>

      {saveState.status === "ok" ? (
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: "#D1FAE5" }}>
          <Text style={{ color: "#065F46", fontSize: 13 }}>{saveState.message}</Text>
        </View>
      ) : null}
      {saveState.status === "error" ? (
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: "#FEE2E2" }}>
          <Text style={{ color: "#991B1B", fontWeight: "700", fontSize: 13 }}>Save failed</Text>
          <Text style={{ color: "#991B1B", fontSize: 13 }}>{saveState.message}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ProviderConfigForm({
  providerId,
  draft,
  theme,
  onChange,
}: {
  providerId: ProviderId;
  draft: ProviderConfig;
  theme: ReturnType<typeof useAppStore>["theme"];
  onChange: (next: ProviderConfig) => void;
}) {
  const provider = PROVIDERS[providerId];
  const [test, setTest] = useState<TestState>({ status: "idle" });

  async function onTest() {
    setTest({ status: "loading" });
    try {
      const snapshot = await buildSnapshot(providerId, draft, false);
      if (snapshot.mode === "needs-key") {
        setTest({ status: "error", message: snapshot.note });
      } else if (snapshot.mode === "failed") {
        setTest({ status: "error", message: snapshot.lastError ?? snapshot.note });
      } else {
        setTest({ status: "ok", message: snapshot.statusLabel + " — " + snapshot.note });
      }
    } catch (error) {
      setTest({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return (
    <View
      style={{
        gap: 12,
        borderRadius: 20,
        padding: 18,
        backgroundColor: theme.panel,
        ...shadowProps("#000000", 0.05),
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: provider.accent, fontSize: 16, fontWeight: "800" }}>{provider.label}</Text>
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>{provider.connectionHint}</Text>
      </View>

      <LabeledInput label="Mode" value={draft.mode} theme={theme} onChangeText={(value) => onChange({ ...draft, mode: value })} />
      <LabeledInput label="API key" value={draft.apiKey} theme={theme} secure onChangeText={(value) => onChange({ ...draft, apiKey: value })} />
      <LabeledInput label="Admin key" value={draft.adminKey} theme={theme} secure onChangeText={(value) => onChange({ ...draft, adminKey: value })} />
      <LabeledInput label="Workspace / org / project" value={draft.workspaceId} theme={theme} onChangeText={(value) => onChange({ ...draft, workspaceId: value })} />
      <LabeledInput label="Requests per minute" value={draft.requestsPerMinuteLimit} theme={theme} keyboardType="number-pad" onChangeText={(value) => onChange({ ...draft, requestsPerMinuteLimit: value })} />
      <LabeledInput label="Tokens per minute" value={draft.tokensPerMinuteLimit} theme={theme} keyboardType="number-pad" onChangeText={(value) => onChange({ ...draft, tokensPerMinuteLimit: value })} />

      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          void onTest();
        }}
        disabled={test.status === "loading"}
        style={{
          alignSelf: "flex-start",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: theme.subtlePanel,
          opacity: test.status === "loading" ? 0.6 : 1,
        }}
      >
        <Text style={{ color: theme.text, fontWeight: "800", fontSize: 13 }}>
          {test.status === "loading" ? "Testing…" : "Test connection"}
        </Text>
      </Pressable>

      {test.status === "ok" ? (
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: "#D1FAE5" }}>
          <Text style={{ color: "#065F46", fontWeight: "700", fontSize: 12 }}>OK</Text>
          <Text style={{ color: "#065F46", fontSize: 12, lineHeight: 17 }}>{test.message}</Text>
        </View>
      ) : null}
      {test.status === "error" ? (
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: "#FEE2E2" }}>
          <Text style={{ color: "#991B1B", fontWeight: "700", fontSize: 12 }}>Failed</Text>
          <Text style={{ color: "#991B1B", fontSize: 12, lineHeight: 17 }}>{test.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  theme,
  onChangeText,
  secure,
  keyboardType,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useAppStore>["theme"];
  onChangeText: (value: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.subtlePanel,
          color: theme.text,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
        }}
      />
    </View>
  );
}
