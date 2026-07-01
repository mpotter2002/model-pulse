import React from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";

import { radius, shadow, spacing, type Radius, type Shadow, type Space } from "@/design-system/tokens";
import { useTheme } from "@/components/ui/theme";

export interface CardProps extends ViewProps {
  padding?: Space;
  radius?: Radius;
  shadow?: Shadow;
  border?: boolean;
  background?: "card" | "muted" | "transparent";
}

export function Card({
  children,
  padding = 4,
  radius: r = "lg",
  shadow: s,
  border = false,
  background = "card",
  style,
  ...props
}: CardProps) {
  const theme = useTheme();

  const bgMap = {
    card: theme.card,
    muted: theme.muted,
    transparent: "transparent",
  };

  const cardStyle: ViewStyle = {
    backgroundColor: bgMap[background],
    borderRadius: radius[r],
    borderCurve: "continuous",
    padding: spacing[padding],
    borderWidth: border ? 1 : 0,
    borderColor: theme.border,
    ...(s ? shadow[s] : {}),
  };

  return (
    <View style={[cardStyle, style]} {...props}>
      {children}
    </View>
  );
}
