import React from "react";
import { ScrollView, View, type ScrollViewProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "@/design-system/tokens";
import { useTheme } from "@/components/ui/theme";

export interface ScreenProps extends ViewProps {
  children: React.ReactNode;
}

export function Screen({ children, style, ...props }: ScreenProps) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.background }, style]} {...props}>
      {children}
    </View>
  );
}

export interface ScreenScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  horizontalPadding?: boolean;
  bottomPadding?: boolean;
}

export function ScreenScrollView({
  children,
  horizontalPadding = true,
  bottomPadding = true,
  contentContainerStyle,
  ...props
}: ScreenScrollViewProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        {
          paddingTop: insets.top + spacing[2],
          paddingHorizontal: horizontalPadding ? spacing[4] : 0,
          paddingBottom: bottomPadding ? spacing[6] + insets.bottom : insets.bottom,
        },
        contentContainerStyle,
      ]}
      style={{ flex: 1, backgroundColor: theme.background }}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
