import React from "react";
import { View, type ViewProps } from "react-native";

import { radius } from "@/design-system/tokens";
import { useAppStore } from "@/store/app-store";
import type { RateLimitStyle } from "@/types/domain";

export interface RateLimitLineProps extends ViewProps {
  value: number;
  color?: string;
  inactiveColor?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  lineStyle?: RateLimitStyle;
}

export function RateLimitLine({
  value,
  color,
  inactiveColor: inactiveColorProp,
  variant = "default",
  lineStyle,
  style,
  ...props
}: RateLimitLineProps) {
  const { theme, rateLimitStyle } = useAppStore();
  const activeStyle = lineStyle ?? rateLimitStyle;
  if (activeStyle === "none") return null;
  const clamped = Math.max(0, Math.min(1, value));
  const colorMap = {
    default: theme.foreground,
    success: theme.success,
    warning: theme.warning,
    destructive: theme.destructive,
  };
  const activeColor = color ?? colorMap[variant];
  const inactiveColor = inactiveColorProp ?? `${theme.foreground}18`;

  if (activeStyle === "dots") {
    const count = 22;
    const activeCount = Math.round(clamped * count);
    return (
      <View style={[{ flexDirection: "row", gap: 4 }, style]} {...props}>
        {Array.from({ length: count }).map((_, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              aspectRatio: 1,
              maxHeight: 6,
              borderRadius: radius.full,
              backgroundColor: index < activeCount ? activeColor : inactiveColor,
            }}
          />
        ))}
      </View>
    );
  }

  if (activeStyle === "dash") {
    const count = 14;
    const activeCount = Math.round(clamped * count);
    return (
      <View style={[{ height: 6, flexDirection: "row", gap: 3 }, style]} {...props}>
        {Array.from({ length: count }).map((_, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: "100%",
              borderRadius: 1,
              backgroundColor: index < activeCount ? activeColor : inactiveColor,
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={[{ height: 6, borderRadius: radius.full, backgroundColor: theme.muted, overflow: "hidden" }, style]}
      {...props}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          borderRadius: radius.full,
          backgroundColor: activeColor,
        }}
      />
    </View>
  );
}
