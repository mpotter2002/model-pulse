import "react-native-gesture-handler";

import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "@/components/error-boundary";
import { configureNotificationHandler } from "@/lib/notifications";
import { AppStoreProvider, useAppStore } from "@/store/app-store";

// Widget module is consumed by the Expo widget bundler via the "use widget"
// directive; we intentionally do NOT require it in the main app bundle.
// Requiring it here caused a fatal Hermes parse error at launch in release builds.

// Present usage alerts as banners even when the app is foregrounded.
configureNotificationHandler();

declare const ErrorUtils:
  | {
      setGlobalHandler: (fn: (err: Error, isFatal?: boolean) => void) => void;
      getGlobalHandler?: () => (err: Error, isFatal?: boolean) => void;
    }
  | undefined;

let lastGlobalError: { message: string; stack: string; isFatal: boolean } | null = null;
export function getLastGlobalError() {
  return lastGlobalError;
}

if (typeof ErrorUtils !== "undefined") {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    lastGlobalError = {
      message: error?.message ?? "Unknown error",
      stack: error?.stack ?? "no stack",
      isFatal: Boolean(isFatal),
    };
    console.warn("[SignalStack] global JS error (suppressed)", lastGlobalError);
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
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!hydrated || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background }}>
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
          headerStyle: { backgroundColor: "transparent" },
          headerBackground: () => (
            <View
              style={{
                flex: 1,
                backgroundColor: theme.background,
                borderBottomLeftRadius: 22,
                borderBottomRightRadius: 22,
                overflow: "hidden",
              }}
            />
          ),
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="model/[id]"
          options={{
            title: "",
            headerTransparent: true,
            headerBackground: () => null,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="provider/[id]"
          options={{
            title: "",
            headerTransparent: true,
            headerBackground: () => null,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "",
            headerTransparent: true,
            headerBackground: () => null,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="widget-settings"
          options={{
            title: "",
            headerTransparent: true,
            headerBackground: () => null,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
      </Stack>
    </>
  );
}
