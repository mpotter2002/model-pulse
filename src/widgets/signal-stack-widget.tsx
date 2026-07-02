"use widget";

import { Capsule, HStack, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
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

// Static arrays so the widget transform can resolve the layout at build time.
const segments12 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

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
    const style = props.rateLimitStyle;

    const family = environment.widgetFamily;
    const isSmall = family === "systemSmall";
    const isMedium = family === "systemMedium";
    const isLarge = family === "systemLarge";

    const cards = props.cards;
    const primary = cards[0] ?? null;

    // Flatten every card's limit windows into a single list (matching the
    // preview's flatLimitRows), up to 3 windows per card.
    const flatLimitRows: WidgetLimitRow[] = cards.flatMap((card) =>
      (card.limitRows ?? []).slice(0, 3),
    );
    const hasLimits = flatLimitRows.length > 0;

    // Summary value: limits mode shows the worst usage as a percent; otherwise
    // the total spend / balance headline number.
    const worstUsed = flatLimitRows.reduce(
      (max, row) => Math.max(max, 1 - Math.max(0, Math.min(1, row.ratio))),
      0,
    );
    const showBalance = props.metricLabel === "Balance" && props.hasLiveApiData;
    const primaryTileLabel = showBalance ? "BALANCE" : "SPEND";
    const primaryTileValue = showBalance ? props.totalBalance : props.totalSpend;
    const summaryLabel = props.metricLabel === "Limits" && hasLimits ? "LIMITS" : primaryTileLabel;
    const summaryValue =
      props.metricLabel === "Limits" && hasLimits
        ? `${Math.round(worstUsed * 100)}%`
        : primaryTileValue;

    const modelsLabel = cards.length === 1 ? "1 MODEL SHOWN" : `${cards.length} MODELS SHOWN`;
    const modelsShown = cards.length === 1 ? "1 model shown" : `${cards.length} models shown`;
    const mediumRows = flatLimitRows.slice(0, 8);
    const mediumHalf = Math.ceil(mediumRows.length / 2);
    const leftLimitRows = mediumRows.slice(0, mediumHalf);
    const rightLimitRows = mediumRows.slice(mediumHalf);

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
                  const activeSegments = Math.round(ratio * 12);
                  const bar =
                    style === "dots" ? (
                      <HStack spacing={3}>
                        {segments12.map((segment) => (
                          <Capsule
                            key={`${row.id}-dot-${segment}`}
                            modifiers={[
                              frame({ width: 4, height: 4 }),
                              foregroundStyle(segment < activeSegments ? row.accent : track),
                            ]}
                          />
                        ))}
                      </HStack>
                    ) : style === "dash" ? (
                      <HStack spacing={3}>
                        {segments12.map((segment) => (
                          <Capsule
                            key={`${row.id}-dash-${segment}`}
                            modifiers={[
                              frame({ width: 3, height: 8 }),
                              foregroundStyle(segment < activeSegments ? row.accent : track),
                            ]}
                          />
                        ))}
                      </HStack>
                    ) : style === "none" ? null : (
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
                    <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 11, weight: "bold" })]}>
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
          {props.hasLiveApiData ? (
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 64, alignment: "leading" })]}>
              <RoundedRectangle cornerRadius={16} modifiers={[foregroundStyle(panel)]} />
              <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
                <Text modifiers={[foregroundStyle(muted), font({ size: 12, design: "monospaced" }), lineLimit(1)]}>
                  TOKENS
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 22, weight: "heavy" }), lineLimit(1)]}>
                  {props.totalTokens}
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
              const activeSegments = Math.round(ratio * 12);
              const bar =
                style === "dots" ? (
                  <HStack spacing={10}>
                    {segments12.map((segment) => (
                      <Capsule
                        key={`${row.id}-dot-${segment}`}
                        modifiers={[
                          frame({ width: 8, height: 8 }),
                          foregroundStyle(segment < activeSegments ? row.accent : track),
                        ]}
                      />
                    ))}
                  </HStack>
                ) : style === "dash" ? (
                  <HStack spacing={5}>
                    {segments12.map((segment) => (
                      <Capsule
                        key={`${row.id}-dash-${segment}`}
                        modifiers={[
                          frame({ width: 13, height: 8 }),
                          foregroundStyle(segment < activeSegments ? row.accent : track),
                        ]}
                      />
                    ))}
                  </HStack>
                ) : style === "none" ? null : (
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
                  {style === "dots" ? (
                    <HStack spacing={3}>
                      {segments12.map((segment) => (
                        <Capsule
                          key={`${row.id}-dot-${segment}`}
                          modifiers={[
                            frame({ width: 4, height: 4 }),
                            foregroundStyle(segment < Math.round(Math.max(0, Math.min(1, row.ratio)) * 12) ? row.accent : track),
                          ]}
                        />
                      ))}
                    </HStack>
                  ) : style === "dash" ? (
                    <HStack spacing={3}>
                      {segments12.map((segment) => (
                        <Capsule
                          key={`${row.id}-dash-${segment}`}
                          modifiers={[
                            frame({ width: 3, height: 10 }),
                            foregroundStyle(segment < Math.round(Math.max(0, Math.min(1, row.ratio)) * 12) ? row.accent : track),
                          ]}
                        />
                      ))}
                    </HStack>
                  ) : style === "none" ? null : (
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
                  {style === "dots" ? (
                    <HStack spacing={3}>
                      {segments12.map((segment) => (
                        <Capsule
                          key={`${row.id}-dot-${segment}`}
                          modifiers={[
                            frame({ width: 4, height: 4 }),
                            foregroundStyle(segment < Math.round(Math.max(0, Math.min(1, row.ratio)) * 12) ? row.accent : track),
                          ]}
                        />
                      ))}
                    </HStack>
                  ) : style === "dash" ? (
                    <HStack spacing={3}>
                      {segments12.map((segment) => (
                        <Capsule
                          key={`${row.id}-dash-${segment}`}
                          modifiers={[
                            frame({ width: 3, height: 10 }),
                            foregroundStyle(segment < Math.round(Math.max(0, Math.min(1, row.ratio)) * 12) ? row.accent : track),
                          ]}
                        />
                      ))}
                    </HStack>
                  ) : style === "none" ? null : (
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
          Updated {props.updatedAt}
        </Text>
      </VStack>
    );
  },
);
