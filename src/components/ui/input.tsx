import React from "react";
import { TextInput, type TextInputProps, type TextStyle } from "react-native";

import { radius, spacing, typography } from "@/design-system/tokens";
import { useTheme } from "@/components/ui/theme";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
}

export function Input({ invalid, style, ...props }: InputProps) {
  const theme = useTheme();

  const inputStyle: TextStyle = {
    backgroundColor: theme.muted,
    color: theme.foreground,
    borderWidth: invalid ? 1 : 0,
    borderColor: invalid ? `${theme.destructive}60` : undefined,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    fontSize: typography.base.fontSize,
    lineHeight: typography.base.lineHeight,
  };

  return (
    <TextInput
      placeholderTextColor={theme.mutedForeground}
      style={[inputStyle, style]}
      {...props}
    />
  );
}
