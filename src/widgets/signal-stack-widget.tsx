"use widget";

import { HStack, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import type { RateLimitStyle } from "@/types/domain";
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget } from "expo-widgets";

import type { ModelCardId, ProviderId } from "@/types/domain";

type WidgetLimitRow = {
  id: string;
  label: string;
  ratio: number;
  accent: string;
};

type WidgetCard = {
  id: ModelCardId;
  providerId?: ProviderId;
  label: string;
  status: string;
  metric: string;
  accent: string;
  ratio?: number;
  limitRows?: WidgetLimitRow[];
};

export type SignalStackWidgetProps = {
  headline: string;
  subheadline: string;
  totalSpend: string;
  totalTokens: string;
  totalBalance: string;
  hasLiveApiData: boolean;
  metricLabel: string;
  updatedAt: string;
  rateLimitStyle: RateLimitStyle;
  cards: WidgetCard[];
};

type SignalStackWidgetConfiguration = {
  focus: "overview" | ModelCardId;
};

export const signalStackWidget = createWidget<SignalStackWidgetProps, SignalStackWidgetConfiguration>(
  "SignalStackWidget",
  (props, environment) => {
    'widget';
    // Palette mirrors WIDGET_COLORS in app/widget-settings.tsx.
    const background = "#000000";
    const panel = "#1C1D20";
    const text = "#F1F1F1";
    const muted = "#8E939A";
    const track = "#2A2B2E";

    // Defensive defaults so the widget still renders when WidgetKit runs the
    // placeholder path with no props. Cast through unknown to avoid transform
    // issues with optional chaining / undefined props.
    const rawProps = (props as unknown as Partial<SignalStackWidgetProps>) ?? {};
    const style: RateLimitStyle = ((rawProps.rateLimitStyle as RateLimitStyle) ?? "bar") as RateLimitStyle;
    const cardsInput: WidgetCard[] = Array.isArray(rawProps.cards) ? (rawProps.cards as WidgetCard[]) : [];
    const totalSpend = rawProps.totalSpend ?? "$0";
    const totalTokens = rawProps.totalTokens ?? "";
    const totalBalance = rawProps.totalBalance ?? "$0.00";
    const hasLiveApiData = rawProps.hasLiveApiData === true;
    const metricLabel = rawProps.metricLabel ?? "Spend";
    const updatedAt = rawProps.updatedAt ?? "now";

    const family = environment.widgetFamily;
    const isSmall = family === "systemSmall";
    const isMedium = family === "systemMedium";
    const isLarge = family === "systemLarge";

    const cards = cardsInput;
    const primary = cards[0] ?? null;

    const flatLimitRows: WidgetLimitRow[] = cards.flatMap((card) =>
      (card.limitRows ?? []).slice(0, 3),
    );
    const hasLimits = flatLimitRows.length > 0;

    const worstUsed = flatLimitRows.reduce(
      (max, row) => Math.max(max, 1 - Math.max(0, Math.min(1, row.ratio))),
      0,
    );
    const showBalance = metricLabel === "Balance" && hasLiveApiData;
    const primaryTileLabel = showBalance ? "BALANCE" : "SPEND";
    const primaryTileValue = showBalance ? totalBalance : totalSpend;
    const summaryLabel = metricLabel === "Limits" && hasLimits ? "LIMITS" : primaryTileLabel;
    const summaryValue =
      metricLabel === "Limits" && hasLimits
        ? `${Math.round(worstUsed * 100)}%`
        : primaryTileValue;

    const modelsLabel = cards.length === 1 ? "1 MODEL SHOWN" : `${cards.length} MODELS SHOWN`;
    const modelsShown = cards.length === 1 ? "1 model shown" : `${cards.length} models shown`;
    const mediumRows = flatLimitRows.slice(0, 8);
    const mediumHalf = Math.ceil(mediumRows.length / 2);
    const leftLimitRows = mediumRows.slice(0, mediumHalf);
    const rightLimitRows = mediumRows.slice(mediumHalf);

    // Precompute style flags so the JSX tree can be static/fixed. The widget
    // transform is much safer with boolean variables than with `||` inside
    // JSX conditionals.
    const isBar = style === "bar";
    const isSegmented = style === "dots" || style === "dash";
    const isNone = style === "none";

    // Helper for empty placeholder to avoid returning `null` from JSX branches,
    // which the SwiftUI evaluator can treat as a crash.
    const EmptyLine = () => (
      <RoundedRectangle cornerRadius={0} modifiers={[frame({ width: 0, height: 0 }), foregroundStyle(track)]} />
    );

    // Small widget explicit segmented bar (6 segments). Explicit static tree
    // avoids the dynamic `.map()` that crashes the layout evaluator.
    const SmallSegmentBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(6, Math.round(Math.max(0, Math.min(1, ratio)) * 6)));
      return (
        <HStack spacing={3}>
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 3, height: 7 }), foregroundStyle(active > 0 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 3, height: 7 }), foregroundStyle(active > 1 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 3, height: 7 }), foregroundStyle(active > 2 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 3, height: 7 }), foregroundStyle(active > 3 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 3, height: 7 }), foregroundStyle(active > 4 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 3, height: 7 }), foregroundStyle(active > 5 ? accent : track)]} />
        </HStack>
      );
    };

    // Medium widget explicit segmented bar (6 segments).
    const MediumSegmentBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(6, Math.round(Math.max(0, Math.min(1, ratio)) * 6)));
      return (
        <HStack spacing={3}>
          <RoundedRectangle cornerRadius={5} modifiers={[frame({ width: 3, height: 10 }), foregroundStyle(active > 0 ? accent : track)]} />
          <RoundedRectangle cornerRadius={5} modifiers={[frame({ width: 3, height: 10 }), foregroundStyle(active > 1 ? accent : track)]} />
          <RoundedRectangle cornerRadius={5} modifiers={[frame({ width: 3, height: 10 }), foregroundStyle(active > 2 ? accent : track)]} />
          <RoundedRectangle cornerRadius={5} modifiers={[frame({ width: 3, height: 10 }), foregroundStyle(active > 3 ? accent : track)]} />
          <RoundedRectangle cornerRadius={5} modifiers={[frame({ width: 3, height: 10 }), foregroundStyle(active > 4 ? accent : track)]} />
          <RoundedRectangle cornerRadius={5} modifiers={[frame({ width: 3, height: 10 }), foregroundStyle(active > 5 ? accent : track)]} />
        </HStack>
      );
    };

    // Large widget explicit segmented bar (8 segments).
    const LargeSegmentBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(8, Math.round(Math.max(0, Math.min(1, ratio)) * 8)));
      return (
        <HStack spacing={5}>
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 0 ? accent : track)]} />
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 1 ? accent : track)]} />
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 2 ? accent : track)]} />
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 3 ? accent : track)]} />
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 4 ? accent : track)]} />
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 5 ? accent : track)]} />
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 6 ? accent : track)]} />
          <RoundedRectangle cornerRadius={4} modifiers={[frame({ width: 13, height: 8 }), foregroundStyle(active > 7 ? accent : track)]} />
        </HStack>
      );
    };

    if (!primary) {
      return (
        <VStack
          alignment="leading"
          spacing={6}
          modifiers={[
            frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
            padding({ all: 14 }),
            containerBackground(background, "widget"),
          ]}
        >
          <Text modifiers={[foregroundStyle(text), font({ size: 15, weight: "bold" })]}>
            SignalStack
          </Text>
          <Text modifiers={[foregroundStyle(muted), font({ size: 11, design: "monospaced" })]}>
            Open SignalStack to sync data
          </Text>
          <Spacer />
        </VStack>
      );
    }

    if (isSmall) {
      return (
        <VStack
          alignment="leading"
          spacing={8}
          modifiers={[
            frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
            padding({ top: 12, bottom: 8, horizontal: 8 }),
            containerBackground(background, "widget"),
          ]}
        >
          {/* Debug style indicator */}
          <HStack alignment="center" spacing={4}>
            <Text modifiers={[foregroundStyle(text), font({ size: 12, weight: "bold" }), lineLimit(1)]}>
              SignalStack
            </Text>
            <Spacer />
            <Text modifiers={[foregroundStyle("#FF0000"), font({ size: 9 }), lineLimit(1)]}>
              {style}
            </Text>
          </HStack>

          {/* Compact tiles: SPEND + MODELS */}
          <HStack spacing={6}>
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 36, alignment: "leading" })]}>
              <RoundedRectangle cornerRadius={12} modifiers={[foregroundStyle(panel)]} />
              <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 8, vertical: 5 })]}>
                <Text modifiers={[foregroundStyle(muted), font({ size: 9, design: "monospaced" }), lineLimit(1)]}>
                  {primaryTileLabel}
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 15, weight: "heavy" }), lineLimit(1)]}>
                  {primaryTileValue}
                </Text>
              </VStack>
            </ZStack>
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 36, alignment: "leading" })]}>
              <RoundedRectangle cornerRadius={12} modifiers={[foregroundStyle(panel)]} />
              <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 8, vertical: 5 })]}>
                <Text modifiers={[foregroundStyle(muted), font({ size: 9, design: "monospaced" }), lineLimit(1)]}>
                  MODELS
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 15, weight: "heavy" }), lineLimit(1)]}>
                  {`${cards.length}`}
                </Text>
              </VStack>
            </ZStack>
          </HStack>

          {/* 7 compact limit rows or fallback metric rows */}
          <VStack alignment="leading" spacing={3}>
            {hasLimits
              ? flatLimitRows.slice(0, 7).map((row) => {
                  const ratio = Math.max(0, Math.min(1, row.ratio));
                  const barFill = Math.max(2, Math.round(ratio * 76));
                  const bar = isSegmented ? (
                    <SmallSegmentBar ratio={ratio} accent={row.accent} />
                  ) : isNone ? (
                    <EmptyLine />
                  ) : (
                    <ZStack alignment="leading" modifiers={[frame({ width: 76, height: 6, alignment: "leading" })]}>
                      <RoundedRectangle cornerRadius={3} modifiers={[foregroundStyle(track), frame({ width: 76, height: 6 })]} />
                      <RoundedRectangle cornerRadius={3} modifiers={[foregroundStyle(row.accent), frame({ width: barFill, height: 6 })]} />
                    </ZStack>
                  );
                  return (
                    <HStack key={row.id} spacing={5} alignment="center">
                      <Text modifiers={[foregroundStyle(row.accent), font({ size: 8 })]}>•</Text>
                      <Text
                        modifiers={[
                          foregroundStyle(text),
                          font({ size: 10, weight: "bold" }),
                          frame({ width: 52, alignment: "leading" }),
                          lineLimit(1),
                          truncationMode("tail"),
                        ]}
                      >
                        {row.label}
                      </Text>
                      {bar}
                    </HStack>
                  );
                })
              : cards.slice(0, 7).map((card) => (
                  <HStack key={card.id} spacing={6} alignment="center">
                    <Text modifiers={[foregroundStyle(card.accent), font({ size: 10 })]}>•</Text>
                    <Text
                      modifiers={[
                        foregroundStyle(text),
                        font({ size: 11, weight: "bold" }),
                        lineLimit(1),
                        truncationMode("tail"),
                      ]}
                    >
                      {card.label}
                    </Text>
                    <Spacer />
                    <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 11, weight: "heavy" })]}>
                      {card.metric}
                    </Text>
                  </HStack>
                ))}
          </VStack>
        </VStack>
      );
    }

    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
          padding({ all: 14 }),
          containerBackground(background, "widget"),
        ]}
      >
        {/* Header */}
        {isMedium ? (
          <HStack spacing={8} alignment="center">
            <Text modifiers={[foregroundStyle(muted), font({ size: 12, design: "monospaced" }), lineLimit(1)]}>
              {modelsShown}
            </Text>
            <Spacer />
            <Text modifiers={[foregroundStyle("#FF0000"), font({ size: 9 }), lineLimit(1)]}>
              {style}
            </Text>
          </HStack>
        ) : (
          <HStack spacing={8} alignment="top">
            <VStack alignment="leading" spacing={1}>
              <Text modifiers={[foregroundStyle(text), font({ size: 15, weight: "bold" }), lineLimit(1)]}>
                SignalStack
              </Text>
              <Text modifiers={[foregroundStyle(muted), font({ size: 12, design: "monospaced" }), lineLimit(1)]}>
                {modelsShown}
              </Text>
            </VStack>
            <Spacer />
            <Text modifiers={[foregroundStyle("#FF0000"), font({ size: 9 }), lineLimit(1)]}>
              {style}
            </Text>
          </HStack>
        )}

        {/* Summary bar (large only) */}
        {isLarge ? (
          <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 60, alignment: "leading" })]}>
            <RoundedRectangle cornerRadius={14} modifiers={[foregroundStyle(panel)]} />
            <VStack alignment="leading" spacing={1} modifiers={[padding({ horizontal: 10, vertical: 7 })]}>
              <Text modifiers={[foregroundStyle(muted), font({ size: 10, weight: "bold", design: "monospaced" }), lineLimit(1)]}>
                {`${summaryLabel} · ${modelsLabel}`}
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 25, weight: "heavy" }), lineLimit(1)]}>
                {summaryValue}
              </Text>
            </VStack>
          </ZStack>
        ) : null}

        {/* Tiles row */}
        <HStack spacing={8}>
          <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 64, alignment: "leading" })]}>
            <RoundedRectangle cornerRadius={16} modifiers={[foregroundStyle(panel)]} />
            <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
              <Text modifiers={[foregroundStyle(muted), font({ size: 12, design: "monospaced" }), lineLimit(1)]}>
                {primaryTileLabel}
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 22, weight: "heavy" }), lineLimit(1)]}>
                {primaryTileValue}
              </Text>
            </VStack>
          </ZStack>
          {hasLiveApiData ? (
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 64, alignment: "leading" })]}>
              <RoundedRectangle cornerRadius={16} modifiers={[foregroundStyle(panel)]} />
              <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
                <Text modifiers={[foregroundStyle(muted), font({ size: 12, design: "monospaced" }), lineLimit(1)]}>
                  TOKENS
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 22, weight: "heavy" }), lineLimit(1)]}>
                  {totalTokens}
                </Text>
              </VStack>
            </ZStack>
          ) : null}
          <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 64, alignment: "leading" })]}>
            <RoundedRectangle cornerRadius={16} modifiers={[foregroundStyle(panel)]} />
            <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
              <Text modifiers={[foregroundStyle(muted), font({ size: 12, design: "monospaced" }), lineLimit(1)]}>
                MODELS
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 22, weight: "heavy" }), lineLimit(1)]}>
                {`${cards.length}`}
              </Text>
            </VStack>
          </ZStack>
        </HStack>

        {/* Limit rows */}
        {isLarge && hasLimits ? (
          <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>
            {flatLimitRows.slice(0, 8).map((row) => {
              const ratio = Math.max(0, Math.min(1, row.ratio));
              const barFill = Math.max(2, Math.round(ratio * 220));
              const bar = isSegmented ? (
                <LargeSegmentBar ratio={ratio} accent={row.accent} />
              ) : isNone ? (
                <EmptyLine />
              ) : (
                <ZStack alignment="leading" modifiers={[frame({ width: 220, height: 8, alignment: "leading" })]}>
                  <RoundedRectangle cornerRadius={4} modifiers={[foregroundStyle(track), frame({ width: 220, height: 8 })]} />
                  <RoundedRectangle cornerRadius={4} modifiers={[foregroundStyle(row.accent), frame({ width: barFill, height: 8 })]} />
                </ZStack>
              );
              return (
                <HStack key={row.id} spacing={7} alignment="center">
                  <Text modifiers={[foregroundStyle(row.accent), font({ size: 10 })]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ size: 12, weight: "bold" }),
                      frame({ width: 92, alignment: "leading" }),
                      lineLimit(1),
                      truncationMode("tail"),
                    ]}
                  >
                    {row.label}
                  </Text>
                  {bar}
                </HStack>
              );
            })}
          </VStack>
        ) : isMedium && hasLimits ? (
          <HStack spacing={12} alignment="top">
            <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>
              {leftLimitRows.map((row) => (
                <HStack key={row.id} spacing={6} alignment="center">
                  <Text modifiers={[foregroundStyle(row.accent), font({ size: 10 })]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ size: 12, weight: "bold" }),
                      frame({ width: 66, alignment: "leading" }),
                      lineLimit(1),
                      truncationMode("tail"),
                    ]}
                  >
                    {row.label}
                  </Text>
                  {isSegmented ? (
                    <MediumSegmentBar ratio={Math.max(0, Math.min(1, row.ratio))} accent={row.accent} />
                  ) : isNone ? (
                    <EmptyLine />
                  ) : (
                    <ZStack alignment="leading" modifiers={[frame({ width: 72, height: 6, alignment: "leading" })]}>
                      <RoundedRectangle cornerRadius={3} modifiers={[foregroundStyle(track), frame({ width: 72, height: 6 })]} />
                      <RoundedRectangle
                        cornerRadius={3}
                        modifiers={[
                          foregroundStyle(row.accent),
                          frame({ width: Math.max(2, Math.round(Math.max(0, Math.min(1, row.ratio)) * 72)), height: 6 }),
                        ]}
                      />
                    </ZStack>
                  )}
                </HStack>
              ))}
            </VStack>
            <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>
              {rightLimitRows.map((row) => (
                <HStack key={row.id} spacing={6} alignment="center">
                  <Text modifiers={[foregroundStyle(row.accent), font({ size: 10 })]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ size: 12, weight: "bold" }),
                      frame({ width: 66, alignment: "leading" }),
                      lineLimit(1),
                      truncationMode("tail"),
                    ]}
                  >
                    {row.label}
                  </Text>
                  {isSegmented ? (
                    <MediumSegmentBar ratio={Math.max(0, Math.min(1, row.ratio))} accent={row.accent} />
                  ) : isNone ? (
                    <EmptyLine />
                  ) : (
                    <ZStack alignment="leading" modifiers={[frame({ width: 72, height: 6, alignment: "leading" })]}>
                      <RoundedRectangle cornerRadius={3} modifiers={[foregroundStyle(track), frame({ width: 72, height: 6 })]} />
                      <RoundedRectangle
                        cornerRadius={3}
                        modifiers={[
                          foregroundStyle(row.accent),
                          frame({ width: Math.max(2, Math.round(Math.max(0, Math.min(1, row.ratio)) * 72)), height: 6 }),
                        ]}
                      />
                    </ZStack>
                  )}
                </HStack>
              ))}
            </VStack>
          </HStack>
        ) : (
          <VStack alignment="leading" spacing={5}>
            {hasLimits
              ? flatLimitRows.slice(0, isLarge ? 8 : 3).map((row) => {
                  const fallbackWidth = isLarge ? 220 : 120;
                  const fallbackFill = Math.max(2, Math.round(Math.max(0, Math.min(1, row.ratio)) * fallbackWidth));
                  return (
                    <HStack key={row.id} spacing={7} alignment="center">
                      <Text modifiers={[foregroundStyle(row.accent), font({ size: 10 })]}>•</Text>
                      <Text
                        modifiers={[
                          foregroundStyle(text),
                          font({ size: 12, weight: "bold" }),
                          frame({ width: isLarge ? 92 : 78, alignment: "leading" }),
                          lineLimit(1),
                          truncationMode("tail"),
                        ]}
                      >
                        {row.label}
                      </Text>
                      <ZStack alignment="leading" modifiers={[frame({ width: fallbackWidth, height: 8, alignment: "leading" })]}>
                        <RoundedRectangle cornerRadius={4} modifiers={[foregroundStyle(track), frame({ width: fallbackWidth, height: 8 })]} />
                        <RoundedRectangle cornerRadius={4} modifiers={[foregroundStyle(row.accent), frame({ width: fallbackFill, height: 8 })]} />
                      </ZStack>
                    </HStack>
                  );
                })
              : cards.slice(0, isLarge ? 7 : 3).map((card) => (
                  <HStack key={card.id} spacing={7} alignment="center">
                    <Text modifiers={[foregroundStyle(card.accent), font({ size: 10 })]}>•</Text>
                    <Text
                      modifiers={[
                        foregroundStyle(text),
                        font({ size: 12, weight: "bold" }),
                        lineLimit(1),
                        truncationMode("tail"),
                      ]}
                    >
                      {card.label}
                    </Text>
                    <Spacer />
                    <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 12, weight: "bold" })]}>
                      {card.metric}
                    </Text>
                  </HStack>
                ))}
          </VStack>
        )}

        <Spacer />

        {/* Footer */}
        <Text modifiers={[foregroundStyle(muted), font({ size: 11, design: "monospaced" }), lineLimit(1)]}>
          Updated {updatedAt}
        </Text>
      </VStack>
    );
  },
);
