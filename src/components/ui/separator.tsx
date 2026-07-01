import React from "react";
import { View, type ViewProps } from "react-native";

import { spacing } from "@/design-system/tokens";
import { useTheme } from "@/components/ui/theme";

export interface SeparatorProps extends ViewProps {
  orientation?: "horizontal" | "vertical";
}

export function Separator({ orientation = "horizontal", style, ...props }: SeparatorProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        orientation === "horizontal"
          ? { height: 1, backgroundColor: theme.border, marginVertical: spacing[3] }
          : { width: 1, backgroundColor: theme.border, marginHorizontal: spacing[3] },
        style,
      ]}
      {...props}
    />
  );
}
