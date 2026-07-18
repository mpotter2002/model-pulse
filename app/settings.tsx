import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { Link } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RateLimitLine } from "@/components/ui/rate-limit-line";
import { ScreenScrollView } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";
import { makeModelCards } from "@/lib/model-cards";
import { requestNotificationPermission } from "@/lib/notifications";
import { useAppStore } from "@/store/app-store";
import type { ModelCardId, RateLimitStyle } from "@/types/domain";

const ROW_HEIGHT = 52;
const ROW_GAP = 8;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;
const ALERT_THRESHOLD_OPTIONS = [25, 50, 75, 80, 90, 95];
const RATE_LIMIT_STYLE_OPTIONS: Array<{ label: string; value: RateLimitStyle }> = [
  { label: "Bar", value: "bar" },
  { label: "Dots", value: "dots" },
  { label: "Dash", value: "dash" },
  { label: "None", value: "none" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    modelCardOrder,
    hiddenModelCardIds,
    updateModelCardPreferences,
    widgetConfig,
    rateLimitStyle,
    updateWidgetConfig,
    setRateLimitStyle,
    notificationPrefs,
    updateNotificationPrefs,
  } = useAppStore();
  const modelCards = makeModelCards();
  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);

  const onToggleAlerts = async (next: boolean) => {
    if (!next) {
      void Haptics.selectionAsync();
      void updateNotificationPrefs({ enabled: false });
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      setShowPermissionHelp(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setShowPermissionHelp(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void updateNotificationPrefs({ enabled: true });
  };

  const onToggleThreshold = (threshold: number) => {
    void Haptics.selectionAsync();
    const current = notificationPrefs.thresholds;
    if (current.includes(threshold)) {
      if (current.length === 1) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return; // keep at least one threshold
      }
      void updateNotificationPrefs({ thresholds: current.filter((t) => t !== threshold) });
    } else {
      void updateNotificationPrefs({ thresholds: [...current, threshold].sort((a, b) => a - b) });
    }
  };
  const theme = useTheme();

  return (
    <ScreenScrollView scrollEnabled={listScrollEnabled} contentContainerStyle={{ paddingTop: insets.top + 52 }}>
      <View style={{ marginBottom: 18 }}>
        <Text size="xs" family="mono" color="muted" style={{ letterSpacing: 1.1, marginBottom: 6 }}>
          CONTROL PANEL // USER CONFIG
        </Text>
        <Text size="2xl" family="sans" weight="extrabold">
          Settings
        </Text>
        <Text size="sm" family="mono" color="muted" style={{ marginTop: 4 }}>
          Organize your home screen cards and widget.
        </Text>
      </View>

      <Link href="/widget-settings" asChild>
        <Pressable style={{ marginBottom: 16 }}>
          <Card padding={4}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}>
                <Text size="xl" family="sans" weight="extrabold" style={{ color: theme.accentForeground }}>
                  W
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
                  WIDGETKIT SURFACE
                </Text>
                <Text size="lg" family="sans" weight="semibold">
                  Home Screen widget
                </Text>
                <Text size="sm" family="mono" color="muted" style={{ marginTop: 2 }}>
                  Pick models, metric style, and preview sizes.
                </Text>
              </View>
              <Image source="sf:chevron.right" style={{ width: 14, height: 14, tintColor: theme.mutedForeground }} />
            </View>
          </Card>
        </Pressable>
      </Link>

      <Card padding={4} style={{ marginBottom: 16 }}>
        <View style={{ gap: 14 }}>
          <View>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
              RATE LIMIT DISPLAY
            </Text>
            <Text size="lg" family="sans" weight="semibold" style={{ marginTop: 2 }}>
              Limit lines
            </Text>
            <Text size="sm" family="mono" color="muted" style={{ marginTop: 2 }}>
              Choose how usage limits render across model and provider cards.
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {RATE_LIMIT_STYLE_OPTIONS.map((option) => {
              const active = rateLimitStyle === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void setRateLimitStyle(option.value);
                  }}
                  style={{
                    borderRadius: 8,
                    backgroundColor: active ? theme.accent : theme.muted,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                      size="sm"
                      family="mono"
                      weight="bold"
                      style={{ color: active ? theme.accentForeground : theme.foreground }}
                    >
                      {option.label.toUpperCase()}
                    </Text>
                    <Text
                      size="xs"
                      family="mono"
                      weight="bold"
                      style={{ color: active ? theme.accentForeground : theme.mutedForeground }}
                    >
                      {active ? "ACTIVE" : "SELECT"}
                    </Text>
                  </View>
                  <RateLimitLine
                    value={0.62}
                    lineStyle={option.value}
                    color={active ? theme.accentForeground : theme.accent}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card padding={4} style={{ marginBottom: 16 }}>
        <View style={{ gap: 14 }}>
          <View>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
              NOTIFICATIONS
            </Text>
            <Text size="lg" family="sans" weight="semibold" style={{ marginTop: 2 }}>
              Usage alerts
            </Text>
            <Text size="sm" family="mono" color="muted" style={{ marginTop: 2 }}>
              Get pinged when a rate-limit window or API budget crosses a threshold.
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.muted,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text size="sm" family="mono" weight="bold">
                Alerts
              </Text>
              <Text size="xs" family="mono" color="muted" style={{ marginTop: 2 }}>
                Local notifications on this iPhone.
              </Text>
            </View>
            <Switch value={notificationPrefs.enabled} onValueChange={(next) => void onToggleAlerts(next)} />
          </View>

          {showPermissionHelp ? (
            <Pressable
              onPress={() => void Linking.openSettings()}
              style={{ backgroundColor: theme.muted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
            >
              <Text size="xs" family="mono" weight="bold" style={{ color: theme.accent }}>
                Notifications are off for Model Pulse in iOS Settings.
              </Text>
              <Text size="xs" family="mono" color="muted" style={{ marginTop: 2 }}>
                Tap here to open Settings and allow them, then flip Alerts on again.
              </Text>
            </Pressable>
          ) : null}

          <View style={{ gap: 8, opacity: notificationPrefs.enabled ? 1 : 0.4 }}>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 0.8 }}>
              ALERT ME AT
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ALERT_THRESHOLD_OPTIONS.map((threshold) => {
                const active = notificationPrefs.thresholds.includes(threshold);
                return (
                  <Pressable
                    key={threshold}
                    disabled={!notificationPrefs.enabled}
                    onPress={() => onToggleThreshold(threshold)}
                    style={{
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      backgroundColor: active ? theme.accent : theme.muted,
                    }}
                  >
                    <Text
                      size="sm"
                      family="mono"
                      weight="bold"
                      style={{ color: active ? theme.accentForeground : theme.foreground }}
                    >
                      {threshold}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8, opacity: notificationPrefs.enabled ? 1 : 0.4 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: theme.muted,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text size="sm" family="mono" weight="bold">
                  Subscription rate limits
                </Text>
                <Text size="xs" family="mono" color="muted" style={{ marginTop: 2 }}>
                  ChatGPT weekly, Claude 5-hour, and other plan windows.
                </Text>
              </View>
              <Switch
                value={notificationPrefs.subscriptionAlerts}
                disabled={!notificationPrefs.enabled}
                onValueChange={(next) => {
                  void Haptics.selectionAsync();
                  void updateNotificationPrefs({ subscriptionAlerts: next });
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: theme.muted,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text size="sm" family="mono" weight="bold">
                  API monthly budgets
                </Text>
                <Text size="xs" family="mono" color="muted" style={{ marginTop: 2 }}>
                  Spend vs the budgets you set on each provider card.
                </Text>
              </View>
              <Switch
                value={notificationPrefs.apiBudgetAlerts}
                disabled={!notificationPrefs.enabled}
                onValueChange={(next) => {
                  void Haptics.selectionAsync();
                  void updateNotificationPrefs({ apiBudgetAlerts: next });
                }}
              />
            </View>
          </View>

          <Text size="xs" family="mono" color="muted">
            Background alerts run when iOS schedules them — usually within a few hours of crossing a threshold.
          </Text>
        </View>
      </Card>

      <Card padding={4} style={{ marginBottom: 16 }}>
        <View style={{ gap: 14 }}>
          <View>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
              MONTHLY COST TABLE
            </Text>
            <Text size="lg" family="sans" weight="semibold" style={{ marginTop: 2 }}>
              Subscription prices
            </Text>
            <Text size="sm" family="mono" color="muted" style={{ marginTop: 2 }}>
              Optional. Added to monthly spend on the home screen and widget.
            </Text>
          </View>
          {modelCards
            .filter((card) => !hiddenModelCardIds.includes(card.id))
            .map((card) => (
              <View
                key={card.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: theme.muted,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: card.accent }} />
                <Text size="sm" family="mono" weight="medium" style={{ flex: 1 }}>
                  {card.title.split(" / ")[0]}
                </Text>
                <Text size="sm" family="mono" color="muted" weight="semibold">
                  $
                </Text>
                <Input
                  value={widgetConfig.subscriptionPricesUsd[card.id]}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  style={{ width: 68, textAlign: "center", fontFamily: "SpaceMono_700Bold" }}
                  onChangeText={(value) => {
                    void updateWidgetConfig({
                      ...widgetConfig,
                      subscriptionPricesUsd: {
                        ...widgetConfig.subscriptionPricesUsd,
                        [card.id]: value.replace(/[^0-9.]/g, ""),
                      },
                    });
                  }}
                />
              </View>
            ))}
        </View>
      </Card>

      <Card padding={4} style={{ marginBottom: 16 }}>
        <View style={{ gap: 14 }}>
          <View>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
              MODULE ORDER
            </Text>
            <Text size="lg" family="sans" weight="semibold" style={{ marginTop: 2 }}>
              Home cards
            </Text>
            <Text size="sm" family="mono" color="muted" style={{ marginTop: 2 }}>
              Long-press the handle, then drag to reorder.
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2 }}>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ width: 34, letterSpacing: 0.8 }}>
              DRAG
            </Text>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ flex: 1, letterSpacing: 0.8 }}>
              MODEL
            </Text>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 0.8 }}>
              SHOW
            </Text>
          </View>
          <DraggableList
            order={modelCardOrder}
            modelCards={modelCards}
            hiddenModelCardIds={hiddenModelCardIds}
            onDragStateChange={setListScrollEnabled}
            onReorder={(next) => {
              void Haptics.selectionAsync();
              void updateModelCardPreferences({ order: next });
            }}
            onToggle={(cardId) => {
              void Haptics.selectionAsync();
              const hidden = hiddenModelCardIds.includes(cardId)
                ? hiddenModelCardIds.filter((id) => id !== cardId)
                : [...hiddenModelCardIds, cardId];
              void updateModelCardPreferences({ hidden });
            }}
          />
        </View>
      </Card>
      <Card padding={4} style={{ marginBottom: 16 }}>
        <View style={{ gap: 10 }}>
          <View>
            <Text size="xs" family="mono" weight="bold" color="muted" style={{ letterSpacing: 1 }}>
              ABOUT
            </Text>
          </View>
          <Pressable
            onPress={() => void Linking.openURL("https://mpotter2002.github.io/model-pulse/privacy.html")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.muted,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text size="sm" family="mono" weight="bold">
                Privacy policy
              </Text>
              <Text size="xs" family="mono" color="muted" style={{ marginTop: 2 }}>
                No accounts, no analytics, no tracking. Keys stay in the iOS Keychain.
              </Text>
            </View>
            <Image source="sf:arrow.up.right" style={{ width: 12, height: 12, tintColor: theme.mutedForeground }} />
          </Pressable>
          <Pressable
            onPress={() => void Linking.openURL("https://mpotter2002.github.io/model-pulse/")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.muted,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text size="sm" family="mono" weight="bold">
                Support
              </Text>
              <Text size="xs" family="mono" color="muted" style={{ marginTop: 2 }}>
                Setup guides and contact.
              </Text>
            </View>
            <Image source="sf:arrow.up.right" style={{ width: 12, height: 12, tintColor: theme.mutedForeground }} />
          </Pressable>
          <Text size="xs" family="mono" color="muted" style={{ marginTop: 2 }}>
            Model Pulse is an independent tracker, not affiliated with the providers it lists.
          </Text>
        </View>
      </Card>
    </ScreenScrollView>
  );
}

function DraggableList({
  order,
  modelCards,
  hiddenModelCardIds,
  onDragStateChange,
  onReorder,
  onToggle,
}: {
  order: ModelCardId[];
  modelCards: ReturnType<typeof makeModelCards>;
  hiddenModelCardIds: ModelCardId[];
  onDragStateChange: (scrollEnabled: boolean) => void;
  onReorder: (next: ModelCardId[]) => void;
  onToggle: (cardId: ModelCardId) => void;
}) {
  const [localOrder, setLocalOrder] = useState(order);
  useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  const [activeId, setActiveId] = useState<ModelCardId | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const orderRef = useRef(localOrder);
  const dragStartOrderRef = useRef<ModelCardId[] | null>(null);
  useEffect(() => {
    orderRef.current = localOrder;
  }, [localOrder]);

  const startDrag = useCallback(
    (cardId: ModelCardId) => {
      setActiveId(cardId);
      dragStartOrderRef.current = orderRef.current;
      onDragStateChange(false);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [onDragStateChange],
  );

  const handleUpdate = useCallback(
    (cardId: ModelCardId, translationY: number) => {
      const startOrder = dragStartOrderRef.current ?? orderRef.current;
      const startIndex = startOrder.indexOf(cardId);
      if (startIndex < 0) return;
      const delta = Math.round(translationY / ROW_STRIDE);
      const targetIndex = Math.max(0, Math.min(startOrder.length - 1, startIndex + delta));
      const current = orderRef.current;
      const currentIndex = current.indexOf(cardId);
      if (currentIndex < 0) return;
      dragY.setValue(translationY - (targetIndex - startIndex) * ROW_STRIDE);
      if (targetIndex !== currentIndex) {
        const next = [...current];
        next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, cardId);
        orderRef.current = next;
        setLocalOrder(next);
        void Haptics.selectionAsync();
      }
    },
    [dragY],
  );

  const handleEnd = useCallback(() => {
    setActiveId(null);
    dragStartOrderRef.current = null;
    onDragStateChange(true);
    dragY.setValue(0);
    onReorder(orderRef.current);
  }, [dragY, onDragStateChange, onReorder]);

  return (
    <View style={{ gap: ROW_GAP }}>
      {localOrder.map((cardId) => {
        const card = modelCards.find((c) => c.id === cardId);
        if (!card) return null;
        const hidden = hiddenModelCardIds.includes(cardId);
        const isActive = activeId === cardId;
        return (
          <DraggableRow
            key={cardId}
            title={card.title}
            accent={card.accent}
            hidden={hidden}
            isActive={isActive}
            anyActive={activeId !== null}
            dragY={dragY}
            onStartDrag={() => startDrag(cardId)}
            onUpdate={(t) => handleUpdate(cardId, t)}
            onEnd={handleEnd}
            onToggle={() => onToggle(cardId)}
          />
        );
      })}
    </View>
  );
}

function DraggableRow({
  title,
  accent,
  hidden,
  isActive,
  anyActive,
  dragY,
  onStartDrag,
  onUpdate,
  onEnd,
  onToggle,
}: {
  title: string;
  accent: string;
  hidden: boolean;
  isActive: boolean;
  anyActive: boolean;
  dragY: Animated.Value;
  onStartDrag: () => void;
  onUpdate: (t: number) => void;
  onEnd: () => void;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => isActiveRef.current,
      onMoveShouldSetPanResponder: (_, gesture) => isActiveRef.current && Math.abs(gesture.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, gesture) => isActiveRef.current && Math.abs(gesture.dy) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        if (!isActiveRef.current) return;
        dragY.setValue(gesture.dy);
        onUpdate(gesture.dy);
      },
      onPanResponderRelease: () => {
        if (isActiveRef.current) onEnd();
      },
      onPanResponderTerminate: () => {
        if (isActiveRef.current) onEnd();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: ROW_HEIGHT,
        borderRadius: 8,
        paddingHorizontal: 8,
        backgroundColor: theme.muted,
        opacity: hidden ? 0.55 : 1,
        transform: [{ translateY: isActive ? dragY : 0 }, { scale: isActive ? 1.02 : 1 }],
        zIndex: isActive ? 10 : 0,
        elevation: isActive ? 6 : 0,
        shadowColor: "#000",
        shadowOpacity: isActive ? 0.18 : 0,
        shadowRadius: isActive ? 12 : 0,
        shadowOffset: { width: 0, height: isActive ? 6 : 0 },
      }}
    >
      <Pressable
        onLongPress={onStartDrag}
        delayLongPress={220}
        disabled={anyActive && !isActive}
        style={{ width: 34, height: ROW_HEIGHT, alignItems: "center", justifyContent: "center" }}
      >
        <Image source="sf:line.3.horizontal" style={{ width: 18, height: 18, tintColor: isActive ? theme.foreground : theme.mutedForeground }} />
      </Pressable>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
        <Text size="sm" family="mono" weight="semibold" color={hidden ? "muted" : "foreground"} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={{ height: ROW_HEIGHT, justifyContent: "center", alignItems: "center" }}>
        <Switch value={!hidden} onValueChange={onToggle} disabled={isActive} />
      </View>
    </Animated.View>
  );
}
