import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React from "react";
import { Pressable, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { ScreenScrollView } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";
import { makeModelCards } from "@/lib/model-cards";
import { useAppStore } from "@/store/app-store";
import type { ModelCardId, ProviderSnapshot, RateLimitStyle, WidgetMetricMode } from "@/types/domain";
import { RateLimitLine } from "@/components/ui/rate-limit-line";
import { getConnectionStatus } from "@/lib/oauth/manager";

const METRIC_OPTIONS: Array<{ label: string; value: WidgetMetricMode }> = [
  { label: "API usage", value: "api" },
  { label: "Subscription limits", value: "subscription" },
];

type WidgetSize = "small" | "medium" | "large";

type PreviewLimitRow = { label: string; ratio: number };

function compactPreviewLimitLabel(providerLabel: string, rowLabel: string, includeProvider: boolean) {
  const cleaned = rowLabel
    .replace("Standard · ", "Std ")
    .replace("5-hour", "5h")
    .replace("Monthly", "Month")
    .replace(" window", "");
  return includeProvider ? `${providerLabel} ${cleaned}` : cleaned;
}


const WIDGET_SIZES: Array<{ label: string; size: WidgetSize; ratioW: number; ratioH: number; scale: number }> = [
  { label: "Small", size: "small", ratioW: 220, ratioH: 220, scale: 1.0 },
  { label: "Medium", size: "medium", ratioW: 364, ratioH: 170, scale: 0.95 },
  { label: "Large", size: "large", ratioW: 364, ratioH: 382, scale: 0.95 },
];

const WIDGET_COLORS = {
  background: "#000000",
  // All chrome containers share one light-grey fill, matching the native
  // home-screen widget (WidgetColors in SignalStackWidget.swift).
  panel: "#1C1D20",
  panelAlt: "#1C1D20",
  track: "#2A2B2E",
  border: "rgba(255,255,255,0.16)",
  text: "#F1F1F1",
  muted: "#8E939A",
  accent: "#3B82F6",
  divider: "rgba(255,255,255,0.08)",
} as const;

export default function WidgetSettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { widgetConfig, updateWidgetConfig, snapshots, rateLimitStyle } = useAppStore();
  const modelCards = makeModelCards();
  const selectedCards = modelCards.filter((card) => widgetConfig.visibleModelCardIds.includes(card.id));
  // The "primary" model is whichever visible card is focused; fall back to the
  // first visible card when the focused one is hidden or unset.
  const primaryCard =
    selectedCards.find((card) => card.id === widgetConfig.focusedModelCardId) ??
    selectedCards[0] ??
    modelCards[0];

  // Live subscription limit rows (5-hour / weekly, etc.) keyed by model card id.
  // Cache-only so opening this screen never hammers a throttled endpoint; the
  // real data is populated by the subscription cards elsewhere in the app.
  const [subLimitRows, setSubLimitRows] = React.useState<Record<string, PreviewLimitRow[]>>({});
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        modelCards
          .filter((card) => card.subscriptionProviderId)
          .map(async (card) => {
            const status = await getConnectionStatus(card.subscriptionProviderId!, {
              allowNetwork: false,
            });
            if (status.kind !== "connected") return [card.id, []] as const;
            const providerLabel = card.title.split(" / ")[0];
            let emitted = 0;
            const rows: PreviewLimitRow[] = status.usage.limits
              .map((row) => ({
                rawLabel: row.label,
                ratio:
                  row.percentUsed !== null && row.percentUsed !== undefined
                    ? Math.max(0, Math.min(1, 1 - row.percentUsed / 100))
                    : row.used !== null &&
                        row.used !== undefined &&
                        row.limit !== null &&
                        row.limit !== undefined &&
                        row.limit > 0
                      ? Math.max(0, Math.min(1, 1 - row.used / row.limit))
                      : null,
              }))
              .filter((row): row is { rawLabel: string; ratio: number } => row.ratio !== null)
              .map((row) => {
                // Match the native widget: the provider name only appears on the
                // first window; later windows show just the window name.
                const label = compactPreviewLimitLabel(providerLabel, row.rawLabel, emitted === 0);
                emitted += 1;
                return { label, ratio: row.ratio };
              });
            return [card.id, rows] as const;
          }),
      );
      if (!cancelled) setSubLimitRows(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetConfig.visibleModelCardIds.join(",")]);
  const [modelsExpanded, setModelsExpanded] = React.useState(false);
  const hiddenCount = modelCards.length - selectedCards.length;

  async function save(next = widgetConfig) {
    await updateWidgetConfig(next);
    Haptics.selectionAsync();
  }

  async function toggleModel(cardId: ModelCardId) {
    const exists = widgetConfig.visibleModelCardIds.includes(cardId);
    const visibleModelCardIds = exists
      ? widgetConfig.visibleModelCardIds.filter((id) => id !== cardId)
      : [...widgetConfig.visibleModelCardIds, cardId];
    if (visibleModelCardIds.length === 0) return;
    // If we just hid the current primary, move it to the first remaining model.
    const focusedModelCardId =
      cardId === widgetConfig.focusedModelCardId && !visibleModelCardIds.includes(cardId)
        ? visibleModelCardIds[0]
        : widgetConfig.focusedModelCardId;
    await save({ ...widgetConfig, visibleModelCardIds, focusedModelCardId });
  }

  async function setPrimary(cardId: ModelCardId) {
    // Making a model primary also ensures it is visible in the widget.
    const visibleModelCardIds = widgetConfig.visibleModelCardIds.includes(cardId)
      ? widgetConfig.visibleModelCardIds
      : [...widgetConfig.visibleModelCardIds, cardId];
    await save({ ...widgetConfig, visibleModelCardIds, focusedModelCardId: cardId });
  }

  return (
    <ScreenScrollView contentContainerStyle={{ paddingTop: insets.top + 52 }}>
      <Text size="xs" family="mono" color="muted" style={{ letterSpacing: 1.1, marginBottom: 6 }}>
        WIDGETKIT // SURFACE CONFIG
      </Text>
      <Text size="2xl" family="sans" weight="extrabold">Widget</Text>
      <Text size="sm" family="mono" color="muted" style={{ marginTop: 4 }}>
        Choose what the real iPhone Home Screen widget should show.
      </Text>

      {/* Models shown */}
      <View style={{ marginTop: 24 }}>
        <Card padding={4}>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setModelsExpanded((value) => !value);
              }}
              style={{
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: theme.subtlePanel,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
                    VISIBLE MODELS
                  </Text>
                  <Text size="lg" family="sans" weight="semibold">Models shown</Text>
                  <Text size="sm" family="mono" color="muted" style={{ marginTop: 2 }}>
                    {selectedCards.length} enabled{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
                  </Text>
                </View>
                <Image
                  source={modelsExpanded ? "sf:chevron.up" : "sf:chevron.down"}
                  style={{ width: 12, height: 12, tintColor: theme.mutedForeground }}
                />
              </View>
              <Text numberOfLines={2} family="mono" size="sm" weight="bold">
                {primaryCard ? `Primary: ${primaryCard.title.split(" / ")[0]}` : "No models enabled"}
              </Text>
            </Pressable>

            {modelsExpanded ? (
              <View style={{ gap: 10 }}>
                <Text size="sm" family="mono" color="muted">
                  Toggle models to include or hide them in the widget. The widget uses the enabled list directly.
                </Text>
                {modelCards.map((card) => {
                  const visible = widgetConfig.visibleModelCardIds.includes(card.id);
                  return (
                    <View
                      key={card.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          borderRadius: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          opacity: visible ? 1 : 0.5,
                        }}
                      >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: card.accent }} />
                        <Text
                          numberOfLines={1}
                          family="mono"
                          size="sm"
                          weight="bold"
                          color={visible ? "foreground" : "muted"}
                        >
                          {card.title.split(" / ")[0]}
                        </Text>
                        {card.id === widgetConfig.focusedModelCardId ? (
                          <View
                            style={{
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              backgroundColor: `${card.accent}22`,
                            }}
                          >
                            <Text size="xs" family="mono" weight="bold" style={{ color: card.accent, letterSpacing: 0.5 }}>
                              PRIMARY
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => {
                          void Haptics.selectionAsync();
                          void setPrimary(card.id);
                        }}
                        hitSlop={8}
                        style={{ padding: 6 }}
                      >
                        <Image
                          source={card.id === widgetConfig.focusedModelCardId ? "sf:star.fill" : "sf:star"}
                          style={{
                            width: 18,
                            height: 18,
                            tintColor:
                              card.id === widgetConfig.focusedModelCardId ? theme.accent : theme.mutedForeground,
                          }}
                        />
                      </Pressable>
                      <Switch
                        value={visible}
                        onValueChange={() => {
                          void toggleModel(card.id);
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </Card>
      </View>

      {/* Primary metric */}
      <View style={{ marginTop: 16 }}>
        <Card padding={4}>
          <View style={{ gap: 12 }}>
            <View>
              <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
                READOUT MODE
              </Text>
              <Text size="lg" family="sans" weight="semibold">Primary metric</Text>
              <Text size="sm" family="mono" color="muted" style={{ marginTop: 4 }}>
                API usage shows balance and tokens; subscription limits shows rate-limit progress bars.
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {METRIC_OPTIONS.map((option) => {
                const active = widgetConfig.metricMode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      void save({ ...widgetConfig, metricMode: option.value });
                    }}
                    style={{
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor: active ? theme.accent : theme.subtlePanel,
                    }}
                  >
                    <Text family="mono" size="sm" weight="bold" style={{ color: active ? theme.accentForeground : theme.foreground }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>
      </View>

      {/* Preview */}
      <View style={{ marginTop: 16 }}>
        <Card padding={4}>
          <View style={{ gap: 14 }}>
            <View>
              <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
                HOME SCREEN PREVIEW
              </Text>
              <Text size="lg" family="sans" weight="semibold">Preview</Text>
              <Text size="sm" family="mono" color="muted" style={{ marginTop: 4 }}>
                Live previews of all three widget sizes. Data fills in as the app syncs.
              </Text>
            </View>
            {WIDGET_SIZES.map((entry) => (
              <View key={entry.label} style={{ gap: 8, alignItems: "center" }}>
                <Text
                  family="mono"
                  size="xs"
                  weight="bold"
                  color="muted"
                  style={{ alignSelf: "flex-start", letterSpacing: 1 }}
                >
                  {entry.label.toUpperCase()}
                </Text>
                <WidgetPreview
                  size={entry.size}
                  width={entry.ratioW * entry.scale}
                  minHeight={entry.ratioH * entry.scale}
                  focusedCardId={primaryCard?.id ?? modelCards[0].id}
                  metricMode={widgetConfig.metricMode}
                  rateLimitStyle={rateLimitStyle}
                  cards={selectedCards}
                  subscriptionPricesUsd={widgetConfig.subscriptionPricesUsd}
                  snapshots={snapshots}
                  subLimitRows={subLimitRows}
                />
              </View>
            ))}
          </View>
        </Card>
      </View>

    </ScreenScrollView>
  );
}

function WidgetPreview({
  size,
  width,
  minHeight,
  focusedCardId,
  metricMode,
  rateLimitStyle,
  cards,
  subscriptionPricesUsd,
  snapshots,
  subLimitRows,
}: {
  size: WidgetSize;
  width: number;
  minHeight: number;
  focusedCardId: ModelCardId;
  metricMode: WidgetMetricMode;
  rateLimitStyle: RateLimitStyle;
  cards: ReturnType<typeof makeModelCards>;
  subscriptionPricesUsd: Record<ModelCardId, string>;
  snapshots: ReturnType<typeof useAppStore>["snapshots"];
  subLimitRows: Record<string, PreviewLimitRow[]>;
}) {
  const focused = cards.find((card) => card.id === focusedCardId) ?? cards[0];
  if (!focused) {
    return (
      <WidgetFrame width={width} minHeight={minHeight}>
        <Text size="sm" color="muted">Enable a model</Text>
      </WidgetFrame>
    );
  }

  const totalSpend = totalSpendFor(cards, subscriptionPricesUsd, snapshots);
  const totalTokens = totalTokensFor(cards, snapshots);
  const totalBalance = totalBalanceFor(cards, snapshots);
  const hasApi = hasLiveApiData(cards, snapshots);
  const updatedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  // Flatten every model's limit windows into a single list (matching the
  // native largeLimitRows: up to 3 windows per card), so the large preview
  // renders one bar per window like the home-screen widget.
  const flatLimitRows: Array<{ label: string; ratio: number; accent: string }> =
    metricMode === "subscription"
      ? cards.flatMap((card) =>
          (subLimitRows[card.id] ?? []).slice(0, 3).map((row) => ({
            label: row.label,
            ratio: row.ratio,
            accent: card.accent,
          })),
        )
      : [];

  // Summary bar mirrors the native widget: limits mode shows the highest
  // usage across all windows as a percent; otherwise total spend.
  const showBalance = metricMode === "api" && hasApi;
  const primaryTileLabel = showBalance ? "BALANCE" : "SPEND";
  const summaryLabel = metricMode === "subscription" ? "Limits" : showBalance ? "Balance" : "Spend";
  const worstUsed = flatLimitRows.reduce((max, row) => Math.max(max, 1 - row.ratio), 0);
  const summaryValue =
    metricMode === "subscription" && flatLimitRows.length > 0
      ? `${Math.round(worstUsed * 100)}%`
      : showBalance
        ? `$${totalBalance.toFixed(2)}`
        : `$${totalSpend.toFixed(0)}`;

  return (
    <WidgetFrame width={width} minHeight={minHeight}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text size="sm" weight="bold" color="foreground" style={{ color: WIDGET_COLORS.text }}>
              SignalStack
            </Text>
            <Text size="xs" family="mono" color="muted" style={{ color: WIDGET_COLORS.muted }}>
              {cards.length === 1 ? "1 model shown" : `${cards.length} models shown`}
            </Text>
          </View>
          {size === "large" ? null : (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: focused.accent, marginTop: 3 }} />
          )}
        </View>

        {size === "large" ? (
          <View
            style={{
              backgroundColor: WIDGET_COLORS.panel,
              borderRadius: 14,
              borderCurve: "continuous" as any,
              paddingHorizontal: 10,
              paddingVertical: 7,
              gap: 1,
            }}
          >
            <Text size="xs" family="mono" weight="bold" style={{ color: WIDGET_COLORS.muted, letterSpacing: 0.4 }} numberOfLines={1}>
              {`${summaryLabel.toUpperCase()} · ${(cards.length === 1 ? "1 MODEL SHOWN" : `${cards.length} MODELS SHOWN`)}`}
            </Text>
            <Text size="2xl" weight="extrabold" style={{ color: WIDGET_COLORS.text, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
              {summaryValue}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <PreviewTile label={primaryTileLabel} value={showBalance ? `$${totalBalance.toFixed(2)}` : `$${totalSpend.toFixed(0)}`} flex={1} />
          {hasApi ? <PreviewTile label="TOKENS" value={compactNumber(totalTokens)} flex={1} /> : null}
          {size === "small" ? (
            hasApi ? null : <PreviewTile label="MODELS" value={`${cards.length}`} flex={1} />
          ) : (
            <PreviewTile label="MODELS" value={`${cards.length}`} flex={1} />
          )}
        </View>

        {size === "medium" && flatLimitRows.length > 0 ? (
          <View style={{ flexDirection: "row", gap: 12, paddingTop: 2 }}>
            {[0, 1].map((col) => {
              const rows = flatLimitRows.slice(0, 8);
              const colCount = Math.ceil(rows.length / 2);
              const colRows = col === 0 ? rows.slice(0, colCount) : rows.slice(colCount);
              return (
                <View key={col} style={{ flex: 1, gap: 5 }}>
                  {colRows.map((row, i) => (
                    <PreviewLimitRowView key={`${row.label}-${i}`} row={row} labelWidth={64} rateLimitStyle={rateLimitStyle} />
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
        <View
          style={{
            paddingTop: 2,
            gap: size === "large" ? 7 : 6,
          }}
        >
          {flatLimitRows.length > 0
            ? flatLimitRows.slice(0, size === "large" ? 8 : 4).map((row, i) => (
                <PreviewLimitRowView
                  key={`${row.label}-${i}`}
                  row={row}
                  labelWidth={size === "large" ? 92 : 52}
                  rateLimitStyle={rateLimitStyle}
                />
              ))
            : cards.slice(0, size === "small" ? 3 : size === "medium" ? 3 : 7).map((card) => (
                <View key={card.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: card.accent }} />
                  <Text
                    size="xs"
                    weight="bold"
                    numberOfLines={1}
                    style={{ width: size === "large" ? 92 : 70, color: WIDGET_COLORS.text }}
                  >
                    {card.title.split(" / ")[0]}
                  </Text>
                  <Spacer />
                  <Text size="xs" family="mono" style={{ color: WIDGET_COLORS.muted, fontVariant: ["tabular-nums"] }}>
                    {cardMetric(card, metricMode, snapshots)}
                  </Text>
                </View>
              ))}
        </View>
        )}

        <View style={{ marginTop: "auto" }}>
          <Text size="xs" family="mono" color="muted" style={{ color: WIDGET_COLORS.muted }}>
            Updated {updatedAt}
          </Text>
        </View>
      </View>
    </WidgetFrame>
  );
}

function WidgetFrame({
  width,
  minHeight,
  children,
}: {
  width: number;
  minHeight: number;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        width,
        minHeight,
        borderRadius: 22,
        borderCurve: "continuous" as any,
        padding: 14,
        backgroundColor: WIDGET_COLORS.background,
        borderWidth: 1,
        borderColor: WIDGET_COLORS.border,
      }}
    >
      {children}
    </View>
  );
}

function PreviewLimitRowView({
  row,
  labelWidth,
  rateLimitStyle,
}: {
  row: { label: string; ratio: number; accent: string };
  labelWidth: number;
  rateLimitStyle: RateLimitStyle;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: row.accent }} />
      <Text size="xs" weight="bold" numberOfLines={1} style={{ width: labelWidth, color: WIDGET_COLORS.text }}>
        {row.label}
      </Text>
      <View style={{ flex: 1 }}>
        <RateLimitLine
          value={row.ratio}
          color={row.accent}
          inactiveColor={WIDGET_COLORS.track}
          lineStyle={rateLimitStyle}
        />
      </View>
    </View>
  );
}

function Spacer() {
  return <View style={{ flex: 1 }} />;
}

function PreviewTile({ label, value, flex }: { label: string; value: string; flex?: number }) {
  return (
    <View style={{ flex: flex ?? 1, borderRadius: 16, backgroundColor: WIDGET_COLORS.panelAlt, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Text size="xs" family="mono" color="muted" style={{ color: WIDGET_COLORS.muted, letterSpacing: 0.3 }}>
        {label}
      </Text>
      <Text size="lg" weight="extrabold" style={{ marginTop: 2, color: WIDGET_COLORS.text, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function cardMetric(
  card: ReturnType<typeof makeModelCards>[number],
  metricMode: WidgetMetricMode,
  snapshots: ReturnType<typeof useAppStore>["snapshots"],
) {
  const snapshot = card.apiProviderId ? snapshots[card.apiProviderId] : null;
  if (metricMode === "api") return snapshot?.balanceLabel ?? `$${snapshot?.usage.monthlySpendUsd.toFixed(2) ?? "0.00"}`;
  if (snapshot?.limits.requestsRemaining !== null && snapshot?.limits.requestsRemaining !== undefined) {
    return compactNumber(snapshot.limits.requestsRemaining);
  }
  return "Plan";
}

function totalSpendFor(
  cards: ReturnType<typeof makeModelCards>,
  subscriptionPricesUsd: Record<ModelCardId, string>,
  snapshots: ReturnType<typeof useAppStore>["snapshots"],
) {
  return cards.reduce((sum, card) => {
    let spend = 0;
    if (card.apiProviderId) {
      const snap = snapshots[card.apiProviderId];
      if (isLiveSnapshot(snap)) spend += snap.usage.monthlySpendUsd;
    }
    if (card.subscriptionProviderId) spend += parseUsd(subscriptionPricesUsd[card.id]);
    return sum + spend;
  }, 0);
}

function totalTokensFor(cards: ReturnType<typeof makeModelCards>, snapshots: ReturnType<typeof useAppStore>["snapshots"]) {
  return cards.reduce((sum, card) => {
    let tokens = 0;
    if (card.apiProviderId) {
      const snap = snapshots[card.apiProviderId];
      if (isLiveSnapshot(snap)) tokens += snap.usage.tokensUsed;
    }
    return sum + tokens;
  }, 0);
}

function totalBalanceFor(cards: ReturnType<typeof makeModelCards>, snapshots: ReturnType<typeof useAppStore>["snapshots"]) {
  return cards.reduce((sum, card) => {
    if (!card.apiProviderId) return sum;
    const snap = snapshots[card.apiProviderId];
    if (!isLiveSnapshot(snap)) return sum;
    return sum + parseUsd(snap.balanceLabel ?? undefined);
  }, 0);
}

function hasLiveApiData(cards: ReturnType<typeof makeModelCards>, snapshots: ReturnType<typeof useAppStore>["snapshots"]): boolean {
  return cards.some((card) => card.apiProviderId && isLiveSnapshot(snapshots[card.apiProviderId]));
}

function isLiveSnapshot(snapshot: ProviderSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return snapshot.mode === "live";
}

function parseUsd(value: string | undefined) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}
