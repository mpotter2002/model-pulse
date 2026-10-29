import { useLocalSearchParams } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ModelDetailPanel } from "@/components/ai-model-card";
import { Card } from "@/components/ui/card";
import { ScreenScrollView } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { getModelCardById } from "@/lib/model-cards";

export default function ModelDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const item = getModelCardById(id);

  if (!item) {
    return (
      <ScreenScrollView contentContainerStyle={{ paddingTop: insets.top + 96 }}>
        <Card padding={5} style={{ alignItems: "center" }}>
          <Text size="xl" weight="bold" style={{ marginBottom: 6 }}>
            Model not found
          </Text>
          <Text size="sm" color="muted" style={{ textAlign: "center" }}>
            This card may have been renamed or removed.
          </Text>
        </Card>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ paddingTop: insets.top + 96 }}>
      <ModelDetailPanel item={item} />
    </ScreenScrollView>
  );
}
