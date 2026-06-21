import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppStoreProvider, useAppStore } from "@/store/app-store";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <RootNavigator />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { hydrated, theme } = useAppStore();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        <StatusBar style={theme.statusBar} />
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.statusBar} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "SignalStack", headerLargeTitle: true }} />
        <Stack.Screen name="provider/[id]" options={{ title: "Provider" }} />
        <Stack.Screen name="settings" options={{ title: "Connections" }} />
      </Stack>
    </>
  );
}
