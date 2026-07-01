import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, type PressableProps, type ViewStyle } from "react-native";

import { radius, spacing, typography, fontWeight } from "@/design-system/tokens";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg";
  haptic?: boolean;
}

export function Button({
  children,
  variant = "default",
  size = "default",
  haptic = true,
  onPress,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const theme = useTheme();

  const variants: Record<string, ViewStyle> = {
    default: { backgroundColor: theme.accent },
    secondary: { backgroundColor: theme.secondary },
    outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border },
    ghost: { backgroundColor: "transparent" },
    destructive: { backgroundColor: theme.destructive },
  };

  const sizes = {
    sm: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.md },
    default: { paddingVertical: spacing[2.5], paddingHorizontal: spacing[4], borderRadius: radius.md },
    lg: { paddingVertical: spacing[3], paddingHorizontal: spacing[5], borderRadius: radius.lg },
  };

  const textColor =
    variant === "default"
      ? "accentForeground"
      : variant === "destructive"
        ? "primaryForeground"
        : variant === "secondary"
          ? "foreground"
          : "foreground";

  const fontSize: "sm" | "base" = size === "sm" ? "sm" : "base";

  const baseStyle: ViewStyle = {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing[1.5],
    borderCurve: "continuous",
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={(e) => {
        if (haptic && !disabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
      }}
      style={({ pressed }) =>
        [
          baseStyle,
          variants[variant],
          sizes[size],
          { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
          typeof style === "function" ? style({ pressed }) : style,
        ] as any
      }
      {...props}
    >
      {typeof children === "string" ? (
        <Text size={fontSize} weight="semibold" color={textColor}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
