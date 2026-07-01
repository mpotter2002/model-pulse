import React from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";

import { radius, spacing, typography } from "@/design-system/tokens";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";

export interface BadgeProps extends ViewProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
  size?: "sm" | "default";
}

export function Badge({ children, variant = "default", size = "default", style, ...props }: BadgeProps) {
  const theme = useTheme();

  const variants: Record<string, ViewStyle> = {
    default: { backgroundColor: theme.primary },
    secondary: { backgroundColor: theme.secondary },
    outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border },
    success: { backgroundColor: `${theme.success}18` },
    warning: { backgroundColor: `${theme.warning}18` },
    destructive: { backgroundColor: `${theme.destructive}18` },
  };

  const textColor =
    variant === "default"
      ? "primaryForeground"
      : variant === "secondary"
        ? "foreground"
        : variant === "success"
          ? "success"
          : variant === "warning"
            ? "warning"
            : variant === "destructive"
              ? "destructive"
              : "foreground";

  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: size === "sm" ? spacing[2] : spacing[2.5],
          paddingVertical: size === "sm" ? spacing[0.5] : spacing[1],
          borderRadius: radius.full,
          borderCurve: "continuous",
        },
        variants[variant],
        style,
      ]}
      {...props}
    >
      <Text size={size === "sm" ? "xs" : "sm"} weight="semibold" color={textColor}>
        {children}
      </Text>
    </View>
  );
}
