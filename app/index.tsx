import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AIModelCard, ModelDetailPanel } from "@/components/ai-model-card";
import { AdaptiveCardGrid } from "@/components/ui/adaptive-card-grid";
import { Card } from "@/components/ui/card";
import { ScreenScrollView } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";
import { makeModelCards } from "@/lib/model-cards";
import { PROVIDER_ORDER } from "@/lib/providers";
import { useAppStore } from "@/store/app-store";
import type { ThemeMode } from "@/types/domain";
import { spacing } from "@/design-system/tokens";

export default function HomeScreen() {
  const {
    snapshots,
    themeMode,
    refreshing,
    refreshAll,
    modelCardOrder,
    hiddenModelCardIds,
    widgetConfig,
    setThemeMode,
  } = useAppStore();
  const theme = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const expandedLandscape = width > height && height >= 600;
  const canSplit = width - insets.left - insets.right >= 820 * Math.max(1, fontScale);
  const [layout, setLayout] = useState<"split" | "grid">("split");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const split = canSplit && layout === "split";
  const [subRefreshNonce, setSubRefreshNonce] = useState(0);
  const userPulledRef = useRef(false);
  const wasRefreshingRef = useRef(false);

  // Fire a completion haptic when a user-pulled refresh finishes, so the
  // gesture has a clear "done" signal even if the data didn't change.
  useEffect(() => {
    if (refreshing) {
      wasRefreshingRef.current = true;
      return;
    }
    if (wasRefreshingRef.current && userPulledRef.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    wasRefreshingRef.current = false;
    userPulledRef.current = false;
  }, [refreshing]);

  const modelCards = makeModelCards()
    .filter((item) => !hiddenModelCardIds.includes(item.id))
    .sort((a, b) => modelCardOrder.indexOf(a.id) - modelCardOrder.indexOf(b.id));
  const selected = modelCards.find((item) => item.id === selectedId) ?? (split ? modelCards[0] : undefined);
  const firstModelId = modelCards[0]?.id;
  useEffect(() => {
    if (split && !selectedId && firstModelId) setSelectedId(firstModelId);
  }, [split, selectedId, firstModelId]);
  const compactDetail = !canSplit && layout === "split" && Boolean(selected);

  const totalSubscriptionSpend = modelCards.reduce(
    (sum, card) => sum + parseUsd(widgetConfig.subscriptionPricesUsd[card.id]),
    0,
  );
  const totalApiSpend = PROVIDER_ORDER.reduce(
    (sum, id) => sum + (snapshots[id].mode === "live" ? snapshots[id].usage.monthlySpendUsd : 0),
    0,
  );
  const totalMonthlySpend = totalSubscriptionSpend + totalApiSpend;
  const totalApiTokens = PROVIDER_ORDER.reduce(
    (sum, id) => sum + (snapshots[id].mode === "live" ? snapshots[id].usage.tokensUsed : 0),
    0,
  );
  const hasLiveApiData = PROVIDER_ORDER.some((id) => snapshots[id].mode === "live");

  const failedCount = PROVIDER_ORDER.filter((id) => snapshots[id].mode === "failed").length;

  function cycleTheme() {
    Haptics.selectionAsync();
    const order: ThemeMode[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    void setThemeMode(next);
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.background }}>
    <View style={{ flex: split ? undefined : 1, width: split ? 352 : undefined, display: compactDetail ? "none" : "flex" }}>
    <ScreenScrollView
      safeAreaEdges={split ? ["top", "left", "bottom"] : undefined}
      contentContainerStyle={{
        paddingTop: insets.top + spacing[6],
        ...(expandedLandscape ? { paddingLeft: insets.left + spacing[6] } : {}),
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.foreground}
          onRefresh={() => {
            Haptics.selectionAsync();
            userPulledRef.current = true;
            void refreshAll();
            setSubRefreshNonce((n) => n + 1);
          }}
        />
      }
    >
      {refreshing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text size="xs" family="mono" color="muted" style={{ letterSpacing: 1.1 }}>
            REFRESHING USAGE...
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 18 }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <Text size="xs" family="mono" color="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ letterSpacing: 1.1, marginBottom: 6 }}>
            LOCAL NODE // MODEL PULSE
          </Text>
          <Text size="3xl" family="sans" weight="extrabold">
            Model Pulse
          </Text>
          <Text size="sm" family="mono" color="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            AI subscription telemetry // live overview
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexShrink: 0, paddingRight: spacing[2] }}>
          <Pressable onPress={cycleTheme} style={{ padding: 8, borderRadius: 999, backgroundColor: theme.muted }}>
            <Image
              source={themeMode === "light" ? "sf:sun.max.fill" : themeMode === "dark" ? "sf:moon.fill" : "sf:circle.lefthalf.filled"}
              style={{ width: 16, height: 16, tintColor: theme.foreground }}
            />
          </Pressable>
          <Link href="/settings" asChild>
            <Pressable style={{ padding: 8, borderRadius: 999, backgroundColor: theme.muted }}>
              <Image source="sf:gearshape.fill" style={{ width: 16, height: 16, tintColor: theme.foreground }} />
            </Pressable>
          </Link>
        </View>
      </View>

      <Card padding={4} style={{ marginBottom: 16 }}>
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text size="xs" family="mono" color="muted" style={{ letterSpacing: 1.2 }}>
              SYSTEM SUMMARY
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent }} />
              <Text size="xs" family="mono" color="muted">
                LIVE
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-end" }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text size="xs" family="mono" weight="medium" color="muted" style={{ letterSpacing: 1 }}>
                MONTHLY SPEND
              </Text>
              <Text
                size="3xl"
                family="sans"
                weight="extrabold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.5 }}
              >
                ${totalMonthlySpend.toFixed(2)}
              </Text>
            </View>
            {hasLiveApiData ? (
              <View style={{ flex: 1, gap: 4 }}>
                <Text size="xs" family="mono" weight="medium" color="muted" style={{ letterSpacing: 1 }}>
                  TOKENS
                </Text>
                <Text size="xl" family="sans" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {compactNumber(totalApiTokens)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text size="xs" family="mono" color="muted" style={{ letterSpacing: 0.8 }}>
            {modelCards.length} MODELS TRACKED // REFRESH {refreshing ? "ACTIVE" : "IDLE"}
          </Text>
        </View>
      </Card>

      {failedCount > 0 ? (
        <Card background="muted" style={{ marginBottom: 16 }}>
          <Text weight="semibold" family="mono" color="destructive" style={{ marginBottom: 4, letterSpacing: 0.8 }}>
            {failedCount} refresh issue{failedCount === 1 ? "" : "s"}
          </Text>
          <Text size="sm" family="mono" color="muted">
            {PROVIDER_ORDER.filter((id) => snapshots[id].mode === "failed")
              .map((id) => snapshots[id].lastError ?? "Unknown error")
              .join(" · ")}
          </Text>
        </Card>
      ) : null}

      {/* Models */}
      <View style={{ marginBottom: 8 }}>
        {canSplit ? (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {(["split", "grid"] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: layout === value }}
                onPress={() => { setLayout(value); if (value === "grid") setSelectedId(null); }}
                style={{ padding: 12, borderRadius: 8, backgroundColor: layout === value ? theme.foreground : theme.muted }}
              >
                <Text size="xs" style={{ color: layout === value ? theme.background : theme.foreground }}>
                  {value === "split" ? "List and detail" : "Grid"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text size="xs" family="mono" weight="bold" color="muted" style={{ marginBottom: 14, letterSpacing: 1.2 }}>
          MODEL GRID
        </Text>
        <AdaptiveCardGrid>
          {modelCards.map((item) => (
            <AIModelCard key={item.id} item={item} refreshNonce={subRefreshNonce}
              onSelect={split ? () => setSelectedId(item.id) : undefined}
              selected={split && selected?.id === item.id}
            />
          ))}
        </AdaptiveCardGrid>
      </View>
    </ScreenScrollView>
    </View>
    {(split || compactDetail) && selected ? (
      <ScreenScrollView
        safeAreaEdges={split ? ["top", "right", "bottom"] : undefined}
        contentContainerStyle={expandedLandscape ? { paddingTop: insets.top + spacing[8] } : undefined}
      >
        {compactDetail ? (
          <Pressable accessibilityRole="button" onPress={() => setSelectedId(null)} style={{ paddingVertical: 12, marginBottom: 12 }}>
            <Text>‹ All models</Text>
          </Pressable>
        ) : null}
        <ModelDetailPanel key={selected.id} item={selected} refreshNonce={subRefreshNonce} />
      </ScreenScrollView>
    ) : null}
    </View>
  );
}


function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}

function parseUsd(value: string | undefined) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
