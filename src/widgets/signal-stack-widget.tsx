"use widget";

import { Host, HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  cornerRadius,
  foregroundStyle,
  monospacedDigit,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget } from "expo-widgets";

import type { ProviderId } from "@/types/domain";

type WidgetCard = {
  id: ProviderId;
  label: string;
  status: string;
  metric: string;
  accent: string;
};

export type SignalStackWidgetProps = {
  headline: string;
  subheadline: string;
  totalSpend: string;
  updatedAt: string;
  cards: WidgetCard[];
};

type SignalStackWidgetConfiguration = {
  focus: "overview" | ProviderId;
};

export const signalStackWidget = createWidget<SignalStackWidgetProps, SignalStackWidgetConfiguration>(
  "SignalStackWidget",
  (props, context) => {
    const focus = context.configuration?.focus ?? "overview";
    const cards = focus === "overview" ? props.cards : props.cards.filter((card) => card.id === focus);
    const primary = cards[0] ?? props.cards[0];

    return (
      <Host matchContents colorScheme="dark">
        <VStack
          spacing={10}
          modifiers={[containerBackground("#0D1418", "widget"), padding({ all: 16 })]}
        >
          <VStack spacing={4}>
            <Text modifiers={[foregroundStyle("#7ADAA6")]}>{props.headline}</Text>
            <Text modifiers={[foregroundStyle("#F5F8FA")]}>
              {focus === "overview" ? props.subheadline : `${primary.label} focus`}
            </Text>
          </VStack>

          <HStack spacing={8}>
            <VStack
              spacing={4}
              modifiers={[padding({ all: 10 }), containerBackground("#152027", "widget"), cornerRadius(16)]}
            >
              <Text modifiers={[foregroundStyle("#8EA0AB")]}>Spend</Text>
              <Text modifiers={[foregroundStyle("#F5F8FA"), monospacedDigit()]}>{props.totalSpend}</Text>
            </VStack>
            <VStack
              spacing={4}
              modifiers={[padding({ all: 10 }), containerBackground("#152027", "widget"), cornerRadius(16)]}
            >
              <Text modifiers={[foregroundStyle("#8EA0AB")]}>Updated</Text>
              <Text modifiers={[foregroundStyle("#F5F8FA"), monospacedDigit()]}>{props.updatedAt}</Text>
            </VStack>
          </HStack>

          {focus === "overview" ? (
            <VStack spacing={8}>
              {props.cards.slice(0, 3).map((card) => (
                <HStack key={card.id} spacing={8}>
                  <Text modifiers={[foregroundStyle(card.accent)]}>{card.label}</Text>
                  <Spacer />
                  <Text modifiers={[foregroundStyle("#F5F8FA"), monospacedDigit()]}>{card.metric}</Text>
                </HStack>
              ))}
            </VStack>
          ) : (
            <VStack
              spacing={8}
              modifiers={[padding({ all: 12 }), containerBackground("#152027", "widget"), cornerRadius(18)]}
            >
              <Text modifiers={[foregroundStyle(primary.accent)]}>{primary.label}</Text>
              <Text modifiers={[foregroundStyle("#F5F8FA")]}>{primary.status}</Text>
              <Text modifiers={[foregroundStyle("#8EA0AB"), monospacedDigit()]}>{primary.metric}</Text>
            </VStack>
          )}
        </VStack>
      </Host>
    );
  },
);
