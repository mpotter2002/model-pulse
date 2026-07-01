"use widget";

import { HStack, Spacer, Text, VStack, ProgressView } from "@expo/ui/swift-ui";
import type { RateLimitStyle } from "@/types/domain";
import {
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget } from "expo-widgets";

import type { ModelCardId, ProviderId } from "@/types/domain";

type WidgetCard = {
  id: ModelCardId;
  providerId?: ProviderId;
  label: string;
  status: string;
  metric: string;
  accent: string;
  ratio?: number;
  limitRows?: Array<{
    id: string;
    label: string;
    ratio: number;
    accent: string;
  }>;
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
  (props) => {
    'widget';
    const colors = {
      background: "#0A0A0B",
      panel: "#141517",
      text: "#F1F1F1",
      muted: "#A7ADB6",
      accent: "#72E3AD",
      track: "#303236",
    };
    const cards = props.cards;
    const primary = cards[0] ?? null;
    const metricValue = props.metricLabel === "Limits" && primary ? primary.metric : props.totalSpend;
    const rows = cards.slice(0, 5);

    if (!primary) {
      return (
          <VStack
            spacing={10}
            modifiers={[containerBackground(colors.background, "widget"), padding({ all: 16 })]}
          >
            <Text modifiers={[foregroundStyle(colors.text), font({ textStyle: "headline", weight: "bold" })]}>{props.headline}</Text>
            <Text modifiers={[foregroundStyle(colors.muted), font({ textStyle: "caption" })]}>Open SignalStack to sync data</Text>
          </VStack>
      );
    }

    return (
        <VStack
          spacing={10}
          modifiers={[containerBackground(colors.background, "widget"), padding({ all: 16 })]}
        >
          <HStack spacing={8} alignment="top">
            <Text modifiers={[foregroundStyle(primary.accent || colors.accent), font({ textStyle: "headline", weight: "bold" })]}>•</Text>
            <VStack spacing={2}>
              <Text modifiers={[foregroundStyle(colors.text), font({ textStyle: "headline", weight: "bold" })]}>
                {props.headline}
              </Text>
              <Text modifiers={[foregroundStyle(colors.muted), font({ textStyle: "caption2" })]}>
                {props.subheadline}
              </Text>
            </VStack>
            <Spacer />
          </HStack>

          <HStack spacing={8}>
            <VStack
              spacing={4}
              modifiers={[padding({ all: 10 }), containerBackground(colors.panel, "widget"), cornerRadius(16)]}
            >
              <Text modifiers={[foregroundStyle(colors.muted), font({ textStyle: "caption2" })]}>SPEND</Text>
              <Text modifiers={[foregroundStyle(colors.text), monospacedDigit(), font({ textStyle: "title3", weight: "bold" })]}>
                {props.totalSpend}
              </Text>
            </VStack>
            <VStack
              spacing={4}
              modifiers={[padding({ all: 10 }), containerBackground(colors.panel, "widget"), cornerRadius(16)]}
            >
              <Text modifiers={[foregroundStyle(colors.muted), font({ textStyle: "caption2" })]}>
                {props.hasLiveApiData ? "TOKENS" : "MODELS"}
              </Text>
              <Text modifiers={[foregroundStyle(colors.text), monospacedDigit(), font({ textStyle: "title3", weight: "bold" })]}>
                {props.hasLiveApiData ? props.totalTokens : `${cards.length}`}
              </Text>
            </VStack>
          </HStack>

          <VStack
            spacing={8}
            modifiers={[padding({ all: 12 }), containerBackground(colors.panel, "widget"), cornerRadius(18)]}
          >
            <Text modifiers={[foregroundStyle(colors.muted), font({ textStyle: "caption2" })]}>
              {props.metricLabel.toUpperCase()}
            </Text>
            <Text modifiers={[foregroundStyle(colors.text), monospacedDigit(), font({ textStyle: "title2", weight: "bold" })]}>
              {metricValue}
            </Text>
            {rows.map((card) => (
              <HStack key={card.id} spacing={8} alignment="center">
                <Text modifiers={[foregroundStyle(card.accent)]}>•</Text>
                <Text modifiers={[foregroundStyle(colors.text), font({ textStyle: "caption", weight: "medium" })]}>
                  {card.label}
                </Text>
                <Spacer />
                <Text modifiers={[foregroundStyle(colors.muted), monospacedDigit(), font({ textStyle: "caption", weight: "bold" })]}>
                  {card.metric}
                </Text>
              </HStack>
            ))}
            {primary.ratio !== undefined && props.rateLimitStyle === "bar" ? (
              <ProgressView
                value={Math.max(0, Math.min(1, primary.ratio))}
                modifiers={[progressViewStyle("linear"), tint(primary.accent)]}
              />
            ) : null}
          </VStack>

          <Spacer />

          <Text
            modifiers={[foregroundStyle(colors.muted), monospacedDigit(), font({ textStyle: "caption2" })]}
          >
            Updated {props.updatedAt}
          </Text>
        </VStack>
    );
  },
);
