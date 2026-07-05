import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React from "react";
import { Pressable, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { ScreenScrollView } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme, tokens } from "@/components/ui/theme";
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

function hasAnyLiveApi(snapshots: ReturnType<typeof useAppStore>["snapshots"]): boolean {
  return Object.values(snapshots).some((snap) => snap?.mode === "live");
}

// API-side bars for the preview, mirroring apiLimitRows in widget-sync:
// spend-vs-budget and requests-remaining, as "fraction remaining".
function previewApiLimitRows(
  card: { id: string; title: string; apiProviderId?: string },
  snapshots: ReturnType<typeof useAppStore>["snapshots"],
): PreviewLimitRow[] {
  if (!card.apiProviderId) return [];
  const snapshot = snapshots[card.apiProviderId as keyof typeof snapshots];
  if (!snapshot || snapshot.mode !== "live") return [];
  const label = card.title.split(" / ")[0];
  const rows: PreviewLimitRow[] = [];
  const budget = snapshot.monthlyBudgetUsd;
  if (budget !== null && budget !== undefined && budget > 0) {
    rows.push({
      label: `${label} budget`,
      ratio: Math.max(0, Math.min(1, 1 - snapshot.usage.monthlySpendUsd / budget)),
    });
  }
  const rpmTotal = snapshot.limits.requestsPerMinuteLimit;
  const rpmRemaining = snapshot.limits.requestsRemaining;
  if (rpmRemaining !== null && rpmTotal !== null && rpmTotal > 0) {
    rows.push({
      label: rows.length === 0 ? `${label} req/min` : "Req/min",
      ratio: Math.max(0, Math.min(1, rpmRemaining / rpmTotal)),
    });
  }
  return rows;
}

// Same fair distribution as the Home Screen widget (see pickLimitRowsFairly in
// signal-stack-widget.tsx): give each provider up to `guaranteed` rows first,
// then round-robin leftover capacity — but emit in provider order so each
// provider's rows (and colors) stay grouped together.
function pickPreviewLimitRowsFairly(
  providers: Array<{ accent: string; rows: PreviewLimitRow[] }>,
  total: number,
  guaranteed: number,
): Array<{ label: string; ratio: number; accent: string }> {
  const allot = providers.map(() => 0);

  let used = 0;
  for (let p = 0; p < providers.length && used < total; p += 1) {
    const give = Math.min(guaranteed, providers[p].rows.length, total - used);
    allot[p] = give;
    used += give;
  }

  let progressed = true;
  while (used < total && progressed) {
    progressed = false;
    for (let p = 0; p < providers.length && used < total; p += 1) {
      if (allot[p] < providers[p].rows.length) {
        allot[p] += 1;
        used += 1;
        progressed = true;
      }
    }
  }

  const out: Array<{ label: string; ratio: number; accent: string }> = [];
  for (let p = 0; p < providers.length; p += 1) {
    for (let i = 0; i < allot[p]; i += 1) {
      const row = providers[p].rows[i];
      out.push({ label: row.label, ratio: row.ratio, accent: providers[p].accent });
    }
  }
  return out;
}

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

function useWidgetColors() {
  const theme = useTheme();
  const isDark = theme.background === tokens.dark.background;
  return {
    background: isDark ? "#000000" : "#FFFFFF",
    // Chrome fill matches the native home-screen widget palette.
    panel: isDark ? "#1C1D20" : "#F2F2F7",
    panelAlt: isDark ? "#1C1D20" : "#F2F2F7",
    track: isDark ? "#2A2B2E" : "#E5E5EA",
    border: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
    text: isDark ? "#F1F1F1" : "#101112",
    muted: isDark ? "#8E939A" : "#6B7077",
    accent: theme.accent,
    divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
  };
}

const BAR_WIDTHS: Record<WidgetSize, number> = {
  small: 130,
  medium: 72,
  large: 200,
};

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
              {widgetConfig.metricMode === "api" && !hasAnyLiveApi(snapshots) ? (
                <Text size="sm" family="mono" color="muted" style={{ marginTop: 6, opacity: 0.9 }}>
                  No live API data yet — API view falls back to subscription bars until you add an
                  API/admin key (and optional monthly budget) in a provider's settings.
                </Text>
              ) : null}
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
  const colors = useWidgetColors();
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

  // Mirror the real Home Screen widget's fair distribution: every provider
  // gets its first 2 windows before any provider gets a 3rd/4th, then extras
  // are added round-robin. Keeps the in-app preview honest.
  const flatLimitRows: Array<{ label: string; ratio: number; accent: string }> =
    pickPreviewLimitRowsFairly(
      cards.map((card) => {
        const subRows = subLimitRows[card.id] ?? [];
        const apiRows = previewApiLimitRows(card, snapshots);
        // Match widget-sync: API mode leads with API bars, subscription mode
        // leads with subscription windows; fall back to the other side.
        const rows =
          metricMode === "api"
            ? (apiRows.length > 0 ? apiRows : subRows)
            : (subRows.length > 0 ? subRows : apiRows);
        return { accent: card.accent, rows };
      }),
      13,
      2,
    );

  const showBalance = metricMode === "api" && hasApi;
  const primaryTileLabel = showBalance ? "BALANCE" : "SPEND";

  return (
    <WidgetFrame width={width} minHeight={minHeight} size={size}>
      <View style={{ gap: 10 }}>
        {size === "large" ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text size="sm" weight="bold" color="foreground" style={{ color: colors.text }}>
                SignalStack
              </Text>
              <Text
                size="xs"
                family="mono"
                color="muted"
                style={{ color: colors.muted, marginTop: 2 }}
              >
                {cards.length === 1 ? "1 model shown" : `${cards.length} models shown`}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <PreviewTile
            label={primaryTileLabel}
            value={showBalance ? `$${totalBalance.toFixed(2)}` : `$${totalSpend.toFixed(0)}`}
            flex={1}
            compact={size === "small"}
          />
          {size === "small" ? (
            <PreviewTile label="MODELS" value={`${cards.length}`} flex={1} compact />
          ) : size === "medium" ? (
            <>
              {hasApi ? <PreviewTile label="TOKENS" value={compactNumber(totalTokens)} flex={1} /> : null}
              <PreviewTile label="MODELS" value={`${cards.length}`} flex={1} />
            </>
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
                    <PreviewLimitRowView key={`${row.label}-${i}`} row={row} labelWidth={66} rateLimitStyle={rateLimitStyle} barWidth={BAR_WIDTHS.medium} />
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
        <View
          style={{
            paddingTop: 2,
            gap: size === "large" ? 3 : 6,
          }}
        >
          {flatLimitRows.length > 0
            ? flatLimitRows.slice(0, size === "large" ? 13 : size === "medium" ? 4 : 7).map((row, i) => (
                <PreviewLimitRowView
                  key={`${row.label}-${i}`}
                  row={row}
                  labelWidth={size === "large" ? 92 : 44}
                  rateLimitStyle={rateLimitStyle}
                  barWidth={size === "large" ? BAR_WIDTHS.large : BAR_WIDTHS.small}
                />
              ))
            : cards.slice(0, size === "small" ? 3 : size === "medium" ? 3 : 7).map((card) => (
                <View key={card.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: card.accent }} />
                  <Text
                    size="xs"
                    weight="bold"
                    numberOfLines={1}
                    style={{ width: size === "large" ? 92 : 70, color: colors.text }}
                  >
                    {card.title.split(" / ")[0]}
                  </Text>
                  <Spacer />
                  <Text size="xs" family="mono" style={{ color: colors.muted, fontVariant: ["tabular-nums"] }}>
                    {cardMetric(card, metricMode, snapshots)}
                  </Text>
                </View>
              ))}
        </View>
        )}

        {size !== "small" ? (
          <View style={{ marginTop: "auto" }}>
            <Text size="xs" family="mono" color="muted" style={{ color: colors.muted }}>
              Updated {updatedAt}
            </Text>
          </View>
        ) : null}
      </View>
    </WidgetFrame>
  );
}

function WidgetFrame({
  width,
  minHeight,
  size,
  children,
}: {
  width: number;
  minHeight: number;
  size?: WidgetSize;
  children: React.ReactNode;
}) {
  const colors = useWidgetColors();
  const padding =
    size === "small"
      ? { paddingTop: 16, paddingBottom: 14, paddingHorizontal: 14 }
      : size === "medium"
        ? { paddingTop: 18, paddingBottom: 18, paddingHorizontal: 14 }
      : size === "large"
        ? { paddingTop: 14, paddingBottom: 4, paddingHorizontal: 14 }
        : { padding: 14 };
  return (
    <View
      style={{
        width,
        minHeight,
        borderRadius: 22,
        borderCurve: "continuous" as any,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        ...padding,
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
  barWidth,
}: {
  row: { label: string; ratio: number; accent: string };
  labelWidth: number;
  rateLimitStyle: RateLimitStyle;
  barWidth: number;
}) {
  const colors = useWidgetColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: row.accent }} />
      <Text size="xs" weight="bold" numberOfLines={1} style={{ width: labelWidth, color: colors.text }}>
        {row.label}
      </Text>
      <View style={{ width: barWidth }}>
        <RateLimitLine
          value={row.ratio}
          color={row.accent}
          inactiveColor={colors.track}
          lineStyle={rateLimitStyle}
          barWidth={barWidth}
        />
      </View>
    </View>
  );
}

function Spacer() {
  return <View style={{ flex: 1 }} />;
}

function PreviewTile({ label, value, flex, compact }: { label: string; value: string; flex?: number; compact?: boolean }) {
  const colors = useWidgetColors();
  return (
    <View
      style={{
        flex: flex ?? 1,
        borderRadius: compact ? 12 : 16,
        backgroundColor: colors.panelAlt,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 5 : 8,
      }}
    >
      <Text
        size="xs"
        family="mono"
        color="muted"
        style={{ color: colors.muted, letterSpacing: 0.3 }}
      >
        {label}
      </Text>
      <Text
        size={compact ? "sm" : "lg"}
        weight="extrabold"
        style={{ marginTop: 2, color: colors.text, fontVariant: ["tabular-nums"] }}
        numberOfLines={1}
      >
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
