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
    // Palette follows the phone's light/dark mode. Defaults to dark when the
    // environment doesn't report a color scheme (e.g. placeholder previews).
    const isDark = environment.colorScheme === "dark" || environment.colorScheme == null;
    const background = isDark ? "#000000" : "#FFFFFF";
    const panel = isDark ? "#1C1D20" : "#F2F2F7";
    const text = isDark ? "#F1F1F1" : "#101112";
    const muted = isDark ? "#8E939A" : "#6B7077";
    const track = isDark ? "#2A2B2E" : "#E5E5EA";

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

    const baseLimitRows: WidgetLimitRow[] = cards.flatMap((card) =>
      (card.limitRows ?? []).slice(0, 3),
    );
    const bonusLimitRows: WidgetLimitRow[] = cards.flatMap((card) =>
      (card.limitRows ?? []).slice(3, 5),
    );
    const flatLimitRows: WidgetLimitRow[] = baseLimitRows.concat(bonusLimitRows);
    const hasLimits = flatLimitRows.length > 0;

    const showBalance = metricLabel === "Balance" && hasLiveApiData;
    const primaryTileLabel = showBalance ? "BALANCE" : "SPEND";
    const primaryTileValue = showBalance ? totalBalance : totalSpend;

    const modelsLabel = cards.length === 1 ? "1 MODEL SHOWN" : `${cards.length} MODELS SHOWN`;
    const modelsShown = cards.length === 1 ? "1 model shown" : `${cards.length} models shown`;
    const mediumRows = flatLimitRows.slice(0, 8);
    const mediumHalf = Math.ceil(mediumRows.length / 2);
    const leftLimitRows = mediumRows.slice(0, mediumHalf);
    const rightLimitRows = mediumRows.slice(mediumHalf);

    // Precompute style flags so the JSX tree can be static/fixed. The widget
    // transform is much safer with boolean variables than with `||` inside
    // JSX conditionals.
    const isNone = style === "none";

    // Helper for empty placeholder to avoid returning `null` from JSX branches,
    // which the SwiftUI evaluator can treat as a crash.
    const EmptyLine = () => (
      <RoundedRectangle cornerRadius={0} modifiers={[frame({ width: 0, height: 0 }), foregroundStyle(track)]} />
    );

    const Gap = ({ width }: { width: number }) => (
      <RoundedRectangle cornerRadius={0} modifiers={[frame({ width, height: 1 }), foregroundStyle(background)]} />
    );

    // SmallDotBar (12 dot segments, fills 84pt).
    const SmallDotBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(12, Math.round(Math.max(0, Math.min(1, ratio)) * 12)));
      return (
        <HStack spacing={1}>
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 0 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 1 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 2 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 3 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 4 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 5 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 6 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 7 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 8 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 9 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 10 ? accent : track)]} />
          <RoundedRectangle cornerRadius={3} modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(active > 11 ? accent : track)]} />
        </HStack>
      );
    };

    // SmallDashBar (7 dash segments, fills 84pt).
    const SmallDashBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(7, Math.round(Math.max(0, Math.min(1, ratio)) * 7)));
      return (
        <HStack spacing={1}>
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 0 ? accent : track)]} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 1 ? accent : track)]} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 2 ? accent : track)]} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 3 ? accent : track)]} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 4 ? accent : track)]} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 5 ? accent : track)]} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 6 ? accent : track)]} />
        </HStack>
      );
    };

    // MediumDotBar (8 dot segments, 7x7 with gap 2, fills 70pt, not touching).
    const MediumDotBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(8, Math.round(Math.max(0, Math.min(1, ratio)) * 8)));
      return (
        <HStack spacing={0}>
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 0 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 1 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 2 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 3 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 4 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 5 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 6 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={3.5} modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(active > 7 ? accent : track)]} />
        </HStack>
      );
    };

    // MediumDashBar (5 dash segments, 11x4 with gap 4, fills 71pt, not touching).
    const MediumDashBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(5, Math.round(Math.max(0, Math.min(1, ratio)) * 5)));
      return (
        <HStack spacing={0}>
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 0 ? accent : track)]} />
          <Gap width={4} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 1 ? accent : track)]} />
          <Gap width={4} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 2 ? accent : track)]} />
          <Gap width={4} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 3 ? accent : track)]} />
          <Gap width={4} />
          <RoundedRectangle cornerRadius={1} modifiers={[frame({ width: 11, height: 4 }), foregroundStyle(active > 4 ? accent : track)]} />
        </HStack>
      );
    };

    // LargeDotBar (20 dot segments, 9x9 with gap 2, fills 218pt, not touching).
    const LargeDotBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(20, Math.round(Math.max(0, Math.min(1, ratio)) * 20)));
      return (
        <HStack spacing={0}>
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 0 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 1 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 2 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 3 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 4 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 5 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 6 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 7 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 8 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 9 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 10 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 11 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 12 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 13 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 14 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 15 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 16 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 17 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 18 ? accent : track)]} />
          <Gap width={2} />
          <RoundedRectangle cornerRadius={4.5} modifiers={[frame({ width: 9, height: 9 }), foregroundStyle(active > 19 ? accent : track)]} />
        </HStack>
      );
    };

    // LargeDashBar (9 dash segments, 20x6 with gap 5, fills 220pt, not touching).
    const LargeDashBar = ({ ratio, accent }: { ratio: number; accent: string }) => {
      const active = Math.max(0, Math.min(9, Math.round(Math.max(0, Math.min(1, ratio)) * 9)));
      return (
        <HStack spacing={0}>
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 0 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 1 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 2 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 3 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 4 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 5 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 6 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 7 ? accent : track)]} />
          <Gap width={5} />
          <RoundedRectangle cornerRadius={2} modifiers={[frame({ width: 20, height: 6 }), foregroundStyle(active > 8 ? accent : track)]} />
        </HStack>
      );
    };
    if (!primary) {
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
          <Text modifiers={[foregroundStyle(text), font({ size: 15, family: "SpaceGrotesk-Bold" })]}>
            SignalStack
          </Text>
          <Text modifiers={[foregroundStyle(muted), font({ size: 11, family: "SpaceMono-Regular" })]}>
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
          spacing={6}
        modifiers={[
            frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
            padding({ top: 16, bottom: 14, horizontal: 14 }),
            containerBackground(background, "widget"),
          ]}
        >
          {/* Compact tiles: SPEND + MODELS */}
          <HStack spacing={6}>
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 36, alignment: "leading" })]}>
              <RoundedRectangle cornerRadius={12} modifiers={[foregroundStyle(panel)]} />
              <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 8, vertical: 4 })]}>
                <Text modifiers={[foregroundStyle(muted), font({ size: 9, family: "SpaceMono-Regular" }), lineLimit(1)]}>
                  {primaryTileLabel}
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 14, family: "SpaceGrotesk-Bold" }), lineLimit(1)]}>
                  {primaryTileValue}
                </Text>
              </VStack>
            </ZStack>
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 36, alignment: "leading" })]}>
              <RoundedRectangle cornerRadius={12} modifiers={[foregroundStyle(panel)]} />
              <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 8, vertical: 4 })]}>
                <Text modifiers={[foregroundStyle(muted), font({ size: 9, family: "SpaceMono-Regular" }), lineLimit(1)]}>
                  MODELS
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 14, family: "SpaceGrotesk-Bold" }), lineLimit(1)]}>
                  {`${cards.length}`}
                </Text>
              </VStack>
            </ZStack>
          </HStack>

          {/* 6 compact limit rows or fallback metric rows */}
          <VStack alignment="leading" spacing={4}>
            {hasLimits
              ? flatLimitRows.slice(0, 6).map((row) => {
                  const ratio = Math.max(0, Math.min(1, row.ratio));
                  const barFill = Math.max(2, Math.round(ratio * 84));
                  const bar = style === "dots" ? (
                    <SmallDotBar ratio={ratio} accent={row.accent} />
                  ) : style === "dash" ? (
                    <SmallDashBar ratio={ratio} accent={row.accent} />
                  ) : isNone ? (
                    <EmptyLine />
                  ) : (
                    <ZStack alignment="leading" modifiers={[frame({ width: 84, height: 6, alignment: "leading" })]}>
                      <RoundedRectangle cornerRadius={3} modifiers={[foregroundStyle(track), frame({ width: 84, height: 6 })]} />
                      <RoundedRectangle cornerRadius={3} modifiers={[foregroundStyle(row.accent), frame({ width: barFill, height: 6 })]} />
                    </ZStack>
                  );
                  return (
                    <HStack key={row.id} spacing={5} alignment="center">
                      <Text modifiers={[foregroundStyle(row.accent), font({ size: 8, family: "SpaceGrotesk-Regular" })]}>•</Text>
                      <Text
                        modifiers={[
                          foregroundStyle(text),
                          font({ size: 10, family: "SpaceGrotesk-Bold" }),
                          frame({ width: 44, alignment: "leading" }),
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
                    <Text modifiers={[foregroundStyle(card.accent), font({ size: 10, family: "SpaceGrotesk-Regular" })]}>•</Text>
                    <Text
                      modifiers={[
                        foregroundStyle(text),
                        font({ size: 11, family: "SpaceGrotesk-Bold" }),
                        lineLimit(1),
                        truncationMode("tail"),
                      ]}
                    >
                      {card.label}
                    </Text>
                    <Spacer />
                    <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 11, family: "SpaceGrotesk-Bold" })]}>
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
        spacing={6}
          modifiers={[
            frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
            padding({ top: isLarge ? 14 : 18, bottom: isLarge ? 4 : 6, horizontal: 14 }),
            containerBackground(background, "widget"),
          ]}
        >
        {/* Header (large only) */}
        {isLarge ? (
          <HStack spacing={6} alignment="top">
            <VStack alignment="leading" spacing={1}>
              <Text modifiers={[foregroundStyle(text), font({ size: 14, family: "SpaceGrotesk-Bold" }), lineLimit(1)]}>
                SignalStack
              </Text>
              <Text modifiers={[foregroundStyle(muted), font({ size: 12, family: "SpaceMono-Regular" }), lineLimit(1)]}>
                {modelsShown}
              </Text>
            </VStack>
          </HStack>
        ) : null}

        {/* Tiles row */}
        <HStack spacing={6}>
          <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 56, alignment: "leading" })]}>
            <RoundedRectangle cornerRadius={16} modifiers={[foregroundStyle(panel)]} />
            <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 10, vertical: 6 })]}>
              <Text modifiers={[foregroundStyle(muted), font({ size: 11, family: "SpaceMono-Regular" }), lineLimit(1)]}>
                {primaryTileLabel}
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 18, family: "SpaceGrotesk-Bold" }), lineLimit(1)]}>
                {primaryTileValue}
              </Text>
            </VStack>
          </ZStack>
          {hasLiveApiData && !isLarge ? (
            <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 56, alignment: "leading" })]}>
              <RoundedRectangle cornerRadius={16} modifiers={[foregroundStyle(panel)]} />
              <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 10, vertical: 6 })]}>
                <Text modifiers={[foregroundStyle(muted), font({ size: 11, family: "SpaceMono-Regular" }), lineLimit(1)]}>
                  TOKENS
                </Text>
                <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 18, family: "SpaceGrotesk-Bold" }), lineLimit(1)]}>
                  {totalTokens}
                </Text>
              </VStack>
            </ZStack>
          ) : null}
          <ZStack alignment="leading" modifiers={[frame({ maxWidth: 10000, height: 56, alignment: "leading" })]}>
            <RoundedRectangle cornerRadius={16} modifiers={[foregroundStyle(panel)]} />
            <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 10, vertical: 6 })]}>
              <Text modifiers={[foregroundStyle(muted), font({ size: 11, family: "SpaceMono-Regular" }), lineLimit(1)]}>
                MODELS
              </Text>
              <Text modifiers={[foregroundStyle(text), monospacedDigit(), font({ size: 18, family: "SpaceGrotesk-Bold" }), lineLimit(1)]}>
                {`${cards.length}`}
              </Text>
            </VStack>
          </ZStack>
        </HStack>

        {/* Limit rows */}
        {isLarge && hasLimits ? (
          <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 10000, alignment: "leading" })]}>
            {flatLimitRows.slice(0, 20).map((row) => {
              const ratio = Math.max(0, Math.min(1, row.ratio));
              const barFill = Math.max(2, Math.round(ratio * 220));
              const bar = style === "dots" ? (
                <LargeDotBar ratio={ratio} accent={row.accent} />
              ) : style === "dash" ? (
                <LargeDashBar ratio={ratio} accent={row.accent} />
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
                  <Text modifiers={[foregroundStyle(row.accent), font({ size: 10, family: "SpaceGrotesk-Regular" })]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ size: 12, family: "SpaceGrotesk-Bold" }),
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
                  <Text modifiers={[foregroundStyle(row.accent), font({ size: 10, family: "SpaceGrotesk-Regular" })]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ size: 11, family: "SpaceGrotesk-Bold" }),
                      frame({ width: 66, alignment: "leading" }),
                      lineLimit(1),
                      truncationMode("tail"),
                    ]}
                  >
                    {row.label}
                  </Text>
                  {style === "dots" ? (
                    <MediumDotBar ratio={Math.max(0, Math.min(1, row.ratio))} accent={row.accent} />
                  ) : style === "dash" ? (
                    <MediumDashBar ratio={Math.max(0, Math.min(1, row.ratio))} accent={row.accent} />
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
                  <Text modifiers={[foregroundStyle(row.accent), font({ size: 10, family: "SpaceGrotesk-Regular" })]}>•</Text>
                  <Text
                    modifiers={[
                      foregroundStyle(text),
                      font({ size: 11, family: "SpaceGrotesk-Bold" }),
                      frame({ width: 66, alignment: "leading" }),
                      lineLimit(1),
                      truncationMode("tail"),
                    ]}
                  >
                    {row.label}
                  </Text>
                  {style === "dots" ? (
                    <MediumDotBar ratio={Math.max(0, Math.min(1, row.ratio))} accent={row.accent} />
                  ) : style === "dash" ? (
                    <MediumDashBar ratio={Math.max(0, Math.min(1, row.ratio))} accent={row.accent} />
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
              ? flatLimitRows.slice(0, isLarge ? 20 : 3).map((row) => {
                  const fallbackWidth = isLarge ? 220 : 120;
                  const fallbackFill = Math.max(2, Math.round(Math.max(0, Math.min(1, row.ratio)) * fallbackWidth));
                  return (
                    <HStack key={row.id} spacing={7} alignment="center">
                      <Text modifiers={[foregroundStyle(row.accent), font({ size: 10, family: "SpaceGrotesk-Regular" })]}>•</Text>
                      <Text
                        modifiers={[
                          foregroundStyle(text),
                          font({ size: 11, family: "SpaceGrotesk-Bold" }),
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
                    <Text modifiers={[foregroundStyle(card.accent), font({ size: 10, family: "SpaceGrotesk-Regular" })]}>•</Text>
                    <Text
                      modifiers={[
                        foregroundStyle(text),
                        font({ size: 12, family: "SpaceGrotesk-Bold" }),
                        lineLimit(1),
                        truncationMode("tail"),
                      ]}
                    >
                      {card.label}
                    </Text>
                    <Spacer />
                    <Text modifiers={[foregroundStyle(muted), monospacedDigit(), font({ size: 12, family: "SpaceGrotesk-Bold" })]}>
                      {card.metric}
                    </Text>
                  </HStack>
                ))}
          </VStack>
        )}

        {/* Footer */}
        <Text modifiers={[foregroundStyle(muted), font({ size: 10, family: "SpaceMono-Regular" }), lineLimit(1), frame({ maxWidth: 10000, alignment: "center" })]}>
          Updated {updatedAt}
        </Text>
      </VStack>
    );
  },
);
