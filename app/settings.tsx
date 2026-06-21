import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { PROVIDER_ORDER, PROVIDERS } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";
import type { ProviderConfig, ProviderId } from "@/types/domain";

export default function SettingsScreen() {
  const { providerConfigs, demoMode, setDemoMode, saveProviderConfig, theme } = useAppStore();
  const [drafts, setDrafts] = useState(providerConfigs);

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
      contentContainerStyle={{ padding: 20, gap: 16 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View
        style={{
          gap: 10,
          borderRadius: 24,
          padding: 18,
          backgroundColor: theme.panel,
          borderWidth: 1,
          borderColor: theme.border,
          boxShadow: theme.shadow,
        }}
      >
        <Text selectable style={{ color: theme.text, fontSize: 19, fontWeight: "800" }}>
          Prototype mode
        </Text>
        <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
          Leave demo mode on while the connectors are still being wired. Turn it off to favor live provider fetches when credentials exist.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
            Demo overlays
          </Text>
          <Switch
            value={demoMode}
            onValueChange={(value) => {
              Haptics.selectionAsync();
              void setDemoMode(value);
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
        disabled={!hasChanges}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          PROVIDER_ORDER.forEach((providerId) => {
            void saveProviderConfig(providerId, drafts[providerId]);
          });
        }}
        style={{
          borderRadius: 18,
          paddingVertical: 15,
          alignItems: "center",
          backgroundColor: hasChanges ? theme.action : theme.border,
        }}
      >
        <Text selectable style={{ color: hasChanges ? "#071015" : theme.muted, fontSize: 16, fontWeight: "800" }}>
          Save connections
        </Text>
      </Pressable>
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

  return (
    <View
      style={{
        gap: 12,
        borderRadius: 24,
        padding: 18,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.border,
        boxShadow: theme.shadow,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: provider.accent, fontSize: 17, fontWeight: "800" }}>
          {provider.label}
        </Text>
        <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
          {provider.connectionHint}
        </Text>
      </View>

      <LabeledInput label="Mode" value={draft.mode} theme={theme} onChangeText={(value) => onChange({ ...draft, mode: value })} />
      <LabeledInput
        label="API key"
        value={draft.apiKey}
        theme={theme}
        secure
        onChangeText={(value) => onChange({ ...draft, apiKey: value })}
      />
      <LabeledInput
        label="Admin key"
        value={draft.adminKey}
        theme={theme}
        secure
        onChangeText={(value) => onChange({ ...draft, adminKey: value })}
      />
      <LabeledInput
        label="Workspace / org / project"
        value={draft.workspaceId}
        theme={theme}
        onChangeText={(value) => onChange({ ...draft, workspaceId: value })}
      />
      <LabeledInput
        label="Requests per minute"
        value={draft.requestsPerMinuteLimit}
        theme={theme}
        keyboardType="number-pad"
        onChangeText={(value) => onChange({ ...draft, requestsPerMinuteLimit: value })}
      />
      <LabeledInput
        label="Tokens per minute"
        value={draft.tokensPerMinuteLimit}
        theme={theme}
        keyboardType="number-pad"
        onChangeText={(value) => onChange({ ...draft, tokensPerMinuteLimit: value })}
      />
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
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
      <TextInput
        value={value}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.subtlePanel,
          color: theme.text,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      />
    </View>
  );
}
