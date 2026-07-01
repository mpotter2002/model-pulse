"use widget";

import { HStack, Spacer, Text, VStack, ProgressView } from "@expo/ui/swift-ui";
import type { RateLimitStyle } from "@/types/domain";
import {
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
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
    const accent = "#3B82F6";

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
    const rowLimit = isLarge ? 6 : isMedium ? 4 : 3;
    const labelWidth = isSmall ? 54 : isMedium ? 74 : 96;

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
          <Text modifiers={[foregroundStyle(text), font({ textStyle: "headline", weight: "bold" })]}>
            SignalStack
          </Text>
          <Text modifiers={[foregroundStyle(muted), font({ textStyle: "caption2" })]}>
            Open SignalStack to sync data
          </Text>
          <Spacer />
        </VStack>
      );
    }

    return (
      <VStack
        alignment="leading"
        spacing={isSmall ? 7 : 9}
        modifiers={[
          frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
          padding({ all: 14 }),
          containerBackground(background, "widget"),
        ]}
      >
        {/* Header */}
        <HStack spacing={8} alignment="top">
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[foregroundStyle(text), font({ textStyle: "subheadline", weight: "bold" })]}>
              SignalStack
            </Text>
            <Text modifiers={[foregroundStyle(muted), font({ textStyle: "caption2" })]}>
              {modelsShown}
            </Text>
          </VStack>
          <Spacer />
          {isLarge ? null : (
            <Text modifiers={[foregroundStyle(primary.accent || accent), font({ textStyle: "headline", weight: "bold" })]}>
              •
            </Text>
          )}
        </HStack>

        {/* Summary bar (large only) */}
        {isLarge ? (
          <VStack
            alignment="leading"
            spacing={1}
            modifiers={[
              frame({ maxWidth: 10000, alignment: "leading" }),
              padding({ horizontal: 10, vertical: 7 }),
              containerBackground(panel, "widget"),
              cornerRadius(14),
            ]}
          >
            <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ textStyle: "caption2", weight: "bold" })]}>
              {`${props.metricLabel.toUpperCase()} · ${modelsLabel}`}
            </Text>
            <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ textStyle: "title", weight: "heavy" })]}>
              {summaryValue}
            </Text>
          </VStack>
        ) : null}

        {/* Tiles row */}
        <HStack spacing={8}>
          <VStack
            alignment="leading"
            spacing={2}
            modifiers={[
              frame({ maxWidth: 10000, alignment: "leading" }),
              padding({ horizontal: 10, vertical: 8 }),
              containerBackground(panel, "widget"),
              cornerRadius(16),
            ]}
          >
            <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ textStyle: "caption2" })]}>
              {primaryTileLabel}
            </Text>
            <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ textStyle: "title3", weight: "heavy" })]}>
              {primaryTileValue}
            </Text>
          </VStack>

          {props.hasLiveApiData ? (
            <VStack
              alignment="leading"
              spacing={2}
              modifiers={[
                frame({ maxWidth: 10000, alignment: "leading" }),
                padding({ horizontal: 10, vertical: 8 }),
                containerBackground(panel, "widget"),
                cornerRadius(16),
              ]}
            >
              <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ textStyle: "caption2" })]}>
                TOKENS
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ textStyle: "title3", weight: "heavy" })]}>
                {props.totalTokens}
              </Text>
            </VStack>
          ) : null}

          {isSmall && props.hasLiveApiData ? null : (
            <VStack
              alignment="leading"
              spacing={2}
              modifiers={[
                frame({ maxWidth: 10000, alignment: "leading" }),
                padding({ horizontal: 10, vertical: 8 }),
                containerBackground(panel, "widget"),
                cornerRadius(16),
              ]}
            >
              <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ textStyle: "caption2" })]}>
                MODELS
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ textStyle: "title3", weight: "heavy" })]}>
                {`${cards.length}`}
              </Text>
            </VStack>
          )}
        </HStack>

        {/* Limit bars, or per-model metric rows */}
        <VStack alignment="leading" spacing={isLarge ? 7 : 6}>
          {hasLimits
            ? flatLimitRows.slice(0, rowLimit).map((row, i) => (
                <HStack key={`${row.id}-${i}`} spacing={7} alignment="center">
                  <Text modifiers={[foregroundStyle(row.accent)]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ textStyle: "caption", weight: "bold" }),
                      frame({ width: labelWidth, alignment: "leading" }),
                    ]}
                  >
                    {row.label}
                  </Text>
                  {props.rateLimitStyle === "bar" ? (
                    <ProgressView
                      value={Math.max(0, Math.min(1, row.ratio))}
                      modifiers={[progressViewStyle("linear"), tint(row.accent)]}
                    />
                  ) : (
                    <Spacer />
                  )}
                  {props.rateLimitStyle === "bar" ? (
                    <Spacer />
                  ) : (
                    <Text
                      modifiers={[
                        foregroundStyle(muted),
                        monospacedDigit(),
                        font({ textStyle: "caption", weight: "bold" }),
                      ]}
                    >
                      {`${Math.round(Math.max(0, Math.min(1, 1 - row.ratio)) * 100)}%`}
                    </Text>
                  )}
                </HStack>
              ))
            : cards.slice(0, rowLimit).map((card) => (
                <HStack key={card.id} spacing={7} alignment="center">
                  <Text modifiers={[foregroundStyle(card.accent)]}>•</Text>
                  <Text modifiers={[foregroundStyle(text), font({ textStyle: "caption", weight: "bold" })]}>
                    {card.label}
                  </Text>
                  <Spacer />
                  <Text
                    modifiers={[
                      foregroundStyle(muted),
                      monospacedDigit(),
                      font({ textStyle: "caption", weight: "bold" }),
                    ]}
                  >
                    {card.metric}
                  </Text>
                </HStack>
              ))}
        </VStack>

        <Spacer />

        {/* Footer */}
        <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ textStyle: "caption2" })]}>
          Updated {props.updatedAt}
        </Text>
      </VStack>
    );
  },
);
