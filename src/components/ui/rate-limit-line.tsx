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
  barWidth?: number;
}

const DOT_CONFIGS: Record<number, { count: number; size: number; gap: number }> = {
  84: { count: 12, size: 6, gap: 1 },
  76: { count: 11, size: 6, gap: 1 },
  72: { count: 8, size: 7, gap: 2 },
  200: { count: 20, size: 8, gap: 2 },
  220: { count: 20, size: 9, gap: 2 },
};

const DASH_CONFIGS: Record<
  number,
  { count: number; width: number; height: number; gap: number; radius: number }
> = {
  84: { count: 7, width: 11, height: 4, gap: 1, radius: 1 },
  76: { count: 6, width: 11, height: 4, gap: 2, radius: 1 },
  72: { count: 5, width: 11, height: 4, gap: 4, radius: 1 },
  200: { count: 10, width: 18, height: 6, gap: 2, radius: 2 },
  220: { count: 9, width: 20, height: 6, gap: 5, radius: 2 },
};

export function RateLimitLine({
  value,
  color,
  inactiveColor: inactiveColorProp,
  variant = "default",
  lineStyle,
  barWidth,
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
  const inactiveColor = inactiveColorProp ?? `${theme.foreground}24`;

  if (activeStyle === "dots") {
    if (barWidth) {
      const cfg = DOT_CONFIGS[barWidth] ?? DOT_CONFIGS[220];
      const activeCount = Math.round(clamped * cfg.count);
      return (
        <View style={[{ width: barWidth, flexDirection: "row", gap: cfg.gap }, style]} {...props}>
          {Array.from({ length: cfg.count }).map((_, index) => (
            <View
              key={index}
              style={{
                width: cfg.size,
                height: cfg.size,
                borderRadius: cfg.size / 2,
                backgroundColor: index < activeCount ? activeColor : inactiveColor,
              }}
            />
          ))}
        </View>
      );
    }
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
    if (barWidth) {
      const cfg = DASH_CONFIGS[barWidth] ?? DASH_CONFIGS[220];
      const activeCount = Math.round(clamped * cfg.count);
      return (
        <View style={[{ width: barWidth, flexDirection: "row", gap: cfg.gap }, style]} {...props}>
          {Array.from({ length: cfg.count }).map((_, index) => (
            <View
              key={index}
              style={{
                width: cfg.width,
                height: cfg.height,
                borderRadius: cfg.radius,
                backgroundColor: index < activeCount ? activeColor : inactiveColor,
              }}
            />
          ))}
        </View>
      );
    }
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
      style={[{ height: 6, borderRadius: radius.full, backgroundColor: inactiveColor, overflow: "hidden", width: "100%" }, style]}
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
