import React from "react";
import { View, type ViewProps } from "react-native";

import { radius } from "@/design-system/tokens";
import { useTheme } from "@/components/ui/theme";

export interface ProgressProps extends ViewProps {
  value: number; // 0..1
  variant?: "default" | "success" | "warning" | "destructive";
  color?: string;
}

export function Progress({ value, variant = "default", color, style, ...props }: ProgressProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, value));

  const colorMap = {
    default: theme.foreground,
    success: theme.success,
    warning: theme.warning,
    destructive: theme.destructive,
  };

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
          backgroundColor: color ?? colorMap[variant],
        }}
      />
    </View>
  );
}
