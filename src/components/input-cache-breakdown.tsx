import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";
import type { ProviderSnapshot } from "@/types/domain";

export function InputCacheBreakdown({ snapshot, compact = false }: { snapshot: ProviderSnapshot; compact?: boolean }) {
  const theme = useTheme();
  const cache = snapshot.usage.inputCache;
  if (!cache && snapshot.mode !== "live") return null;
  if (!cache) return (
    <Text size="xs" color="muted" style={{ marginTop: 10 }}>
      Input cache breakdown unavailable. Refresh to check for provider data.
    </Text>
  );
  const rows: [string, string][] = [
    ["Fresh input", tokens(cache.freshInputTokens)],
    ["Cache reads", tokens(cache.cacheReadTokens)],
    ["Cache writes", tokens(cache.cacheWriteTokens)],
    ["Cache reuse", cache.cacheReusePercent === null ? (cache.freshInputTokens === 0 && cache.cacheReadTokens === 0 && (cache.cacheWriteTokens ?? 0) === 0 ? "No input data" : "Not reported") : `${cache.cacheReusePercent.toFixed(1)}%`],
  ];
  return (
    <View style={{ gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
      <Text size="sm" weight="semibold">Input cache · {cache.windowLabel.toLowerCase()}</Text>
      {rows.filter(([label]) => !compact || label !== "Cache writes").map(([label, value]) => (
        <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text size="xs" color="muted" style={{ flex: 1 }}>{label}</Text>
          <Text size="xs" weight="semibold" style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}>{value}</Text>
        </View>
      ))}
      {!compact ? (
        <Text size="xs" color="muted">
          Cache reuse is the share of input tokens read from cache. Cache reads usually cost less; writes also cost money. Spend above is month-to-date.
        </Text>
      ) : null}
      {snapshot.lastError ? <Text size="xs" color="muted">Saved data · latest refresh failed</Text> : null}
    </View>
  );
}

function tokens(value: number | null) {
  return value === null ? "Not reported" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
