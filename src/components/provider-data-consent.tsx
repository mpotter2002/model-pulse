import * as Linking from "expo-linking";
import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";

const PRIVACY_POLICY_URL = "https://mpotter2002.github.io/model-pulse/privacy.html";

export function ProviderDataConsentModal({
  visible,
  onAllow,
  onNotNow,
}: {
  visible: boolean;
  onAllow: () => void;
  onNotNow: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onNotNow}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28, gap: 18 }}
        >
          <View style={{ gap: 6 }}>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
              PROVIDER DATA PERMISSION
            </Text>
            <Text size="2xl" family="sans" weight="extrabold">
              Share data with connected providers?
            </Text>
            <Text size="sm" color="muted">
              Model Pulse can work without connecting any account. Choose Allow only if you want live provider data.
            </Text>
          </View>

          <DisclosureSection title="What is sent">
            When you connect or refresh a provider, Model Pulse sends the API key, admin key, OAuth access token, OAuth refresh token, or authorization code you chose to that provider. It also sends the request needed to retrieve your account telemetry.
          </DisclosureSection>

          <DisclosureSection title="What comes back">
            The provider may return your plan name, usage and quota windows, reset times, token and request totals, account balance, and organization spend. Model Pulse stores credentials in iOS Keychain and telemetry on this device for the app, widget, and optional local alerts.
          </DisclosureSection>

          <DisclosureSection title="Who receives it">
            Only the provider you choose: OpenAI/ChatGPT, Anthropic/Claude, Moonshot/Kimi, MiniMax, Z.ai, Google/Gemini, ElevenLabs, Poe, Codebuff, GitHub/Copilot, Chutes, Factory, OpenCode, OpenRouter, or fal.ai. Requests go directly from this device to that provider; Model Pulse does not operate a server.
          </DisclosureSection>

          <DisclosureSection title="What is not sent">
            Model Pulse does not send chat prompts, chat responses, files, contacts, analytics, advertising identifiers, or data to a Model Pulse server.
          </DisclosureSection>

          <Text size="xs" color="muted">
            You can stop sharing at any time in Settings. This removes saved provider credentials and stops future provider refreshes.
          </Text>

          <Pressable onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} style={{ alignSelf: "flex-start" }}>
            <Text size="sm" weight="semibold" color="primary">
              Read privacy policy
            </Text>
          </Pressable>

          <View style={{ gap: 10, marginTop: 2 }}>
            <Button onPress={onAllow}>Allow provider data sharing</Button>
            <Button variant="secondary" onPress={onNotNow}>
              Not now
            </Button>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DisclosureSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 5, backgroundColor: theme.muted, borderRadius: 8, padding: 14 }}>
      <Text size="sm" family="mono" weight="bold">
        {title}
      </Text>
      <Text size="sm" color="muted">
        {children}
      </Text>
    </View>
  );
}
