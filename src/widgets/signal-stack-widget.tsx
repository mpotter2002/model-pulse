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

export const signalStackWidget = createWidget<SignalStackWidgetProps, SignalStackWidgetConfiguration>(
  "SignalStackWidget",
  (props, environment) => {
    'widget';
    // Palette mirrors WIDGET_COLORS in app/widget-settings.tsx so the native
    // widget matches the in-app preview exactly.
    const background = "#000000";
    const panel = "#1C1D20";
    const text = "#F1F1F1";
    const muted = "#8E939A";
    const track = "#2A2B2E";
    const segments = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

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
    const summaryValue =
      props.metricLabel === "Limits" && hasLimits
        ? `${Math.round(worstUsed * 100)}%`
        : props.metricLabel === "Balance"
          ? props.totalBalance
          : props.totalSpend;

    const modelsLabel = cards.length === 1 ? "1 MODEL SHOWN" : `${cards.length} MODELS SHOWN`;
    const modelsShown = cards.length === 1 ? "1 model shown" : `${cards.length} models shown`;
    const primaryTileLabel = props.metricLabel === "Balance" ? "BALANCE" : "SPEND";
    const primaryTileValue = props.metricLabel === "Balance" ? props.totalBalance : props.totalSpend;
    const rowLimit = isLarge ? 8 : isMedium ? 8 : 3;
    const labelWidth = isSmall ? 54 : isMedium ? 78 : 92;
    const leftLimitRows = flatLimitRows.slice(0, Math.ceil(Math.min(rowLimit, flatLimitRows.length) / 2));
    const rightLimitRows = flatLimitRows.slice(Math.ceil(Math.min(rowLimit, flatLimitRows.length) / 2), rowLimit);

    if (!primary) {
      return (
        <VStack
          alignment="leading"
          spacing={6}
          modifiers={[
            frame({ maxWidth: 10000, alignment: "topLeading" }),
            padding({ all: 14 }),
            containerBackground(background, "widget"),
          ]}
        >
          <Text modifiers={[foregroundStyle(text), font({ size: 15, weight: "bold" })]}>
            SignalStack
          </Text>
          <Text modifiers={[foregroundStyle(muted), font({ size: 11 })]}>
            Open SignalStack to sync data
          </Text>
          <Spacer />
        </VStack>
      );
    }

    return (
      <VStack
        alignment="leading"
        spacing={isSmall ? 6 : 8}
        modifiers={[
          frame({ maxWidth: 10000, alignment: "topLeading" }),
          padding({ all: isSmall ? 12 : 14 }),
          containerBackground(background, "widget"),
        ]}
      >
        {/* Header */}
        {isMedium ? (
          <HStack spacing={8} alignment="center">
            <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 12, design: "monospaced" }), lineLimit(1)]}>
              {modelsShown}
            </Text>
          </HStack>
        ) : (
          <HStack spacing={8} alignment="top">
            <VStack alignment="leading" spacing={1}>
              <Text modifiers={[foregroundStyle(text), font({ size: isSmall ? 13 : 15, weight: "bold" }), lineLimit(1)]}>
                SignalStack
              </Text>
              <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: isSmall ? 10 : 12, design: "monospaced" }), lineLimit(1)]}>
                {modelsShown}
              </Text>
            </VStack>
          </HStack>
        )}

        {/* Summary bar (large only) */}
        {isLarge ? (
          <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 60, alignment: "leading" })]}>
            <RoundedRectangle
              cornerRadius={14}
              modifiers={[foregroundStyle(panel)]}
            />
            <VStack alignment="leading" spacing={1} modifiers={[padding({ horizontal: 10, vertical: 7 })]}>
              <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 10, weight: "bold", design: "monospaced" }), lineLimit(1)]}>
                {`${props.metricLabel.toUpperCase()} · ${modelsLabel}`}
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 25, weight: "heavy" }), lineLimit(1)]}>
                {summaryValue}
              </Text>
            </VStack>
          </ZStack>
        ) : null}

        {/* Tiles row */}
        <HStack spacing={8}>
          <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: isSmall ? 52 : 64, alignment: "leading" })]}>
            <RoundedRectangle
              cornerRadius={16}
              modifiers={[foregroundStyle(panel)]}
            />
            <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
              <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: isSmall ? 10 : 12, design: "monospaced" }), lineLimit(1)]}>
                {primaryTileLabel}
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: isSmall ? 18 : 22, weight: "heavy" }), lineLimit(1)]}>
                {primaryTileValue}
              </Text>
            </VStack>
          </ZStack>

          {props.hasLiveApiData ? (
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: isSmall ? 52 : 64, alignment: "leading" })]}>
              <RoundedRectangle
                cornerRadius={16}
                modifiers={[foregroundStyle(panel)]}
              />
              <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
                <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: isSmall ? 10 : 12, design: "monospaced" }), lineLimit(1)]}>
                  TOKENS
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: isSmall ? 18 : 22, weight: "heavy" }), lineLimit(1)]}>
                  {props.totalTokens}
                </Text>
              </VStack>
            </ZStack>
          ) : null}

          {isSmall && props.hasLiveApiData ? null : (
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: isSmall ? 52 : 64, alignment: "leading" })]}>
              <RoundedRectangle
                cornerRadius={16}
                modifiers={[foregroundStyle(panel)]}
              />
              <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
                <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: isSmall ? 10 : 12, design: "monospaced" }), lineLimit(1)]}>
                  MODELS
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: isSmall ? 18 : 22, weight: "heavy" }), lineLimit(1)]}>
                  {`${cards.length}`}
                </Text>
              </VStack>
            </ZStack>
          )}
        </HStack>

        {/* Limit bars, or per-model metric rows */}
        {isMedium && hasLimits ? (
          <HStack spacing={12} alignment="top">
            <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>
              {leftLimitRows.map((row, i) => (
                <HStack key={`${row.id}-left-${i}`} spacing={6} alignment="center">
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
                  <HStack spacing={3}>
                    {segments.map((segment) => (
                      <Capsule
                        key={`${row.id}-left-segment-${segment}`}
                        modifiers={[
                          frame({ width: 3, height: 10 }),
                          foregroundStyle(segment < Math.round(Math.max(0, Math.min(1, row.ratio)) * 12) ? row.accent : track),
                        ]}
                      />
                    ))}
                  </HStack>
                </HStack>
              ))}
            </VStack>
            <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>
              {rightLimitRows.map((row, i) => (
                <HStack key={`${row.id}-right-${i}`} spacing={6} alignment="center">
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
                  <HStack spacing={3}>
                    {segments.map((segment) => (
                      <Capsule
                        key={`${row.id}-right-segment-${segment}`}
                        modifiers={[
                          frame({ width: 3, height: 10 }),
                          foregroundStyle(segment < Math.round(Math.max(0, Math.min(1, row.ratio)) * 12) ? row.accent : track),
                        ]}
                      />
                    ))}
                  </HStack>
                </HStack>
              ))}
            </VStack>
          </HStack>
        ) : (
        <VStack alignment="leading" spacing={isLarge ? 7 : 5}>
          {hasLimits
            ? flatLimitRows.slice(0, rowLimit).map((row, i) => (
                <HStack key={`${row.id}-${i}`} spacing={7} alignment="center">
                  <Text modifiers={[foregroundStyle(row.accent), font({ size: 10 })]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ size: isSmall ? 11 : 12, weight: "bold" }),
                      frame({ width: labelWidth, alignment: "leading" }),
                      lineLimit(1),
                      truncationMode("tail"),
                    ]}
                  >
                    {row.label}
                  </Text>
                  <HStack spacing={3}>
                    {segments.map((segment) => (
                      <Capsule
                        key={`${row.id}-segment-${segment}`}
                        modifiers={[
                          frame({ width: isSmall ? 3 : 4, height: isSmall ? 8 : 10 }),
                          foregroundStyle(segment < Math.round(Math.max(0, Math.min(1, row.ratio)) * 12) ? row.accent : track),
                        ]}
                      />
                    ))}
                  </HStack>
                </HStack>
              ))
            : cards.slice(0, rowLimit).map((card) => (
                <HStack key={card.id} spacing={7} alignment="center">
                  <Text modifiers={[foregroundStyle(card.accent), font({ size: 10 })]}>•</Text>
                  <Text modifiers={[foregroundStyle(text), font({ size: 12, weight: "bold" }), lineLimit(1), truncationMode("tail")]}>
                    {card.label}
                  </Text>
                  <Spacer />
                  <Text
                    modifiers={[
                      foregroundStyle(muted),
                      monospacedDigit(),
                      font({ size: 12, weight: "bold" }),
                    ]}
                  >
                    {card.metric}
                  </Text>
                </HStack>
              ))}
        </VStack>
        )}

        <Spacer />

        {/* Footer */}
        <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 11, design: "monospaced" }), lineLimit(1)]}>
          Updated {props.updatedAt}
        </Text>
      </VStack>
    );
  },
);
