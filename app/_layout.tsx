import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppStoreProvider, useAppStore } from "@/store/app-store";
import { AppErrorBoundary } from "@/components/error-boundary";


declare const ErrorUtils: { setGlobalHandler: (fn: (err: Error, isFatal?: boolean) => void) => void } | undefined;
if (typeof ErrorUtils !== "undefined") {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.warn("[SignalStack] global JS error", { isFatal, message: error?.message, stack: error?.stack });
  });
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AppStoreProvider>
          <RootNavigator />
        </AppStoreProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
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
