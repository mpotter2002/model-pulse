import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

import { radius, spacing } from "@/design-system/tokens";
import { useTheme } from "@/components/ui/theme";

export type Theme = ReturnType<typeof useTheme>;

/**
 * A translucent "liquid glass" surface. Falls back to a solid panel on
 * platforms where blur is unavailable.
 */
export function GlassCard({
  children,
  style,
  intensity = 40,
  radius: r = "2xl",
  padding = 4,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  radius?: "lg" | "xl" | "2xl" | number;
  padding?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | number;
}) {
  const theme = useTheme();
  const blurSupported = Platform.OS !== "web";

  return (
    <View
      style={[
        {
          borderRadius: typeof r === "number" ? r : radius[r],
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          backgroundColor: blurSupported ? "transparent" : theme.card,
        },
        style,
      ]}
    >
      {blurSupported ? (
        <BlurView intensity={intensity} tint={theme.blurTint} style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={
          theme.glassTint === "dark"
            ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]
            : ["rgba(255,255,255,0.70)", "rgba(255,255,255,0.35)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.glassFill }]} />
      <View style={{ padding: typeof padding === "number" && padding > 6 ? padding : spacing[padding as keyof typeof spacing] }}>{children}</View>
    </View>
  );
}

export function ScreenBackground({ theme }: { theme: Theme }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />;
}

export function GlassChip({
  children,
  tint,
}: {
  children: React.ReactNode;
  theme: Theme;
  tint?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tint ? `${tint}55` : theme.border,
        backgroundColor: tint ? `${tint}1A` : theme.muted,
      }}
    >
      {children}
    </View>
  );
}
