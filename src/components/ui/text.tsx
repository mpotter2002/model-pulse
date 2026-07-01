import React from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { fontFamily, fontWeight, typography, type TextSize } from "@/design-system/tokens";
import { useTheme } from "@/components/ui/theme";

export interface TextProps extends RNTextProps {
  size?: TextSize;
  weight?: keyof typeof fontWeight;
  family?: keyof typeof fontFamily;
  color?: "foreground" | "muted" | "primary" | "primaryForeground" | "accent" | "accentForeground" | "destructive" | "success" | "warning";
  align?: "left" | "center" | "right";
  truncate?: boolean;
}

export function Text({
  children,
  size = "base",
  weight = "normal",
  family = "sans",
  color = "foreground",
  align = "left",
  truncate = false,
  style,
  ...props
}: TextProps) {
  const theme = useTheme();
  const numberOfLines = truncate ? props.numberOfLines ?? 1 : props.numberOfLines;

  const colorMap: Record<string, string> = {
    foreground: theme.foreground,
    muted: theme.mutedForeground,
    primary: theme.primary,
    primaryForeground: theme.primaryForeground,
    accent: theme.accent,
    accentForeground: theme.accentForeground,
    destructive: theme.destructive,
    success: theme.success,
    warning: theme.warning,
  };

  const textStyle: TextStyle = {
    ...typography[size],
    fontFamily: fontFamily[family][weight],
    color: colorMap[color],
    textAlign: align,
  };

  return (
    <RNText
      numberOfLines={numberOfLines}
      ellipsizeMode={truncate ? props.ellipsizeMode ?? "tail" : props.ellipsizeMode}
      style={[textStyle, style]}
      {...props}
    >
      {children}
    </RNText>
  );
}
