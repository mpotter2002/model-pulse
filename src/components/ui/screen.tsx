import React, { useState } from "react";
import { ScrollView, View, useWindowDimensions, type ScrollViewProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Edge } from "react-native-safe-area-context";

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
  maxContentWidth?: number;
  safeAreaEdges?: Edge[];
}

export function ScreenScrollView({
  children,
  horizontalPadding = true,
  bottomPadding = true,
  maxContentWidth,
  safeAreaEdges = ["top", "bottom", "left", "right"],
  contentContainerStyle,
  onLayout,
  automaticallyAdjustKeyboardInsets = true,
  keyboardShouldPersistTaps = "handled",
  keyboardDismissMode = "on-drag",
  ...props
}: ScreenScrollViewProps) {
  const safeInsets = useSafeAreaInsets();
  const insets = {
    top: safeAreaEdges.includes("top") ? safeInsets.top : 0,
    bottom: safeAreaEdges.includes("bottom") ? safeInsets.bottom : 0,
    left: safeAreaEdges.includes("left") ? safeInsets.left : 0,
    right: safeAreaEdges.includes("right") ? safeInsets.right : 0,
  };
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const left = Math.max(insets.left, horizontalPadding ? spacing[4] : 0);
  const right = Math.max(insets.right, horizontalPadding ? spacing[4] : 0);
  // Limit reading width on detail/forms while keeping the background edge to edge.
  const extra = maxContentWidth ? Math.max(0, (containerWidth ?? width) - left - right - maxContentWidth) / 2 : 0;

  return (
    <ScrollView
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
        onLayout?.(event);
      }}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      contentContainerStyle={[
        {
          paddingTop: insets.top + spacing[2],
          paddingLeft: left + extra,
          paddingRight: right + extra,
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
