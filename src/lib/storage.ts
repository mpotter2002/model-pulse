import * as SecureStore from "expo-secure-store";

import { DEFAULT_PROVIDER_CONFIG, DEFAULT_STORED_STATE, PROVIDER_ORDER } from "@/lib/providers";
import type { ModelCardId, ProviderConfig, ProviderId, RateLimitStyle, StoredState, WidgetMetricMode } from "@/types/domain";

const STORAGE_KEY = "signalstack-state-v1";

export async function loadStoredState(): Promise<StoredState> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(STORAGE_KEY);
  } catch (error) {
    console.warn("[SignalStack] SecureStore read failed; using defaults.", error);
    return DEFAULT_STORED_STATE;
  }
  if (!raw) return DEFAULT_STORED_STATE;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const providerConfigs = PROVIDER_ORDER.reduce(
      (acc, providerId) => {
        const stored = parsed.providerConfigs?.[providerId];
        acc[providerId] = mergeProviderConfig(
          DEFAULT_STORED_STATE.providerConfigs[providerId],
          stored,
        );
        return acc;
      },
      {} as Record<ProviderId, ProviderConfig>,
    );
    return {
      demoMode: false,
      themeMode: (typeof parsed.themeMode === "string" && ["light", "dark", "system"].includes(parsed.themeMode)) ? parsed.themeMode : DEFAULT_STORED_STATE.themeMode,
      rateLimitStyle: migrateRateLimitStyle(parsed.rateLimitStyle),
      providerConfigs,
      modelCardOrder: mergeModelCardOrder(parsed.modelCardOrder),
      hiddenModelCardIds: mergeHiddenModelCards(parsed.hiddenModelCardIds),
      widgetConfig: {
        headline:
          typeof parsed.widgetConfig?.headline === "string" && parsed.widgetConfig.headline.trim()
            ? parsed.widgetConfig.headline
            : DEFAULT_STORED_STATE.widgetConfig.headline,
        metricMode: migrateMetricMode(parsed.widgetConfig?.metricMode),
        visibleProviderIds: mergeWidgetProviders(parsed.widgetConfig?.visibleProviderIds),
        visibleModelCardIds: mergeWidgetModelCards(
          parsed.widgetConfig?.visibleModelCardIds ?? legacyProviderIdsToModelCards(parsed.widgetConfig?.visibleProviderIds),
        ),
        focusedModelCardId: isModelCardId(parsed.widgetConfig?.focusedModelCardId)
          ? parsed.widgetConfig.focusedModelCardId
          : DEFAULT_STORED_STATE.widgetConfig.focusedModelCardId,
        subscriptionPricesUsd: mergeSubscriptionPrices(parsed.widgetConfig?.subscriptionPricesUsd),
      },
    };
  } catch (error) {
    console.warn("[SignalStack] Stored state was invalid JSON; resetting.", error);
    return DEFAULT_STORED_STATE;
  }
}

function mergeModelCardOrder(value: unknown): ModelCardId[] {
  const defaults = DEFAULT_STORED_STATE.modelCardOrder;
  if (!Array.isArray(value)) return defaults;
  const valid = value.filter(isModelCardId);
  return [...valid, ...defaults.filter((id) => !valid.includes(id))];
}

function mergeHiddenModelCards(value: unknown): ModelCardId[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isModelCardId)));
}

function mergeWidgetProviders(value: unknown): ProviderId[] {
  const defaults = DEFAULT_STORED_STATE.widgetConfig.visibleProviderIds;
  if (!Array.isArray(value)) return defaults;
  const valid = value.filter(isProviderId);
  return valid.length > 0 ? valid : defaults;
}

function mergeWidgetModelCards(value: unknown): ModelCardId[] {
  const defaults = DEFAULT_STORED_STATE.widgetConfig.visibleModelCardIds;
  if (!Array.isArray(value)) return defaults;
  const valid = value.filter(isModelCardId);
  return valid.length > 0 ? valid : defaults;
}

function legacyProviderIdsToModelCards(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.filter(isProviderId);
}

function mergeSubscriptionPrices(value: unknown): Record<ModelCardId, string> {
  const defaults = DEFAULT_STORED_STATE.widgetConfig.subscriptionPricesUsd;
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const record = value as Partial<Record<ModelCardId, unknown>>;
  return DEFAULT_STORED_STATE.modelCardOrder.reduce(
    (acc, id) => {
      const stored = record[id];
      acc[id] = typeof stored === "string" ? stored : defaults[id];
      return acc;
    },
    {} as Record<ModelCardId, string>,
  );
}

function isModelCardId(value: unknown): value is ModelCardId {
  return typeof value === "string" && DEFAULT_STORED_STATE.modelCardOrder.includes(value as ModelCardId);
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "kimi";
}

function migrateMetricMode(value: unknown): WidgetMetricMode {
  if (value === "limits" || value === "subscription") return "subscription";
  if (value === "api" || value === "spend" || value === "tokens" || value === "balance") return "api";
  return DEFAULT_STORED_STATE.widgetConfig.metricMode;
}

function migrateRateLimitStyle(value: unknown): RateLimitStyle {
  if (value === "bar" || value === "dots" || value === "dash" || value === "none") return value;
  return DEFAULT_STORED_STATE.rateLimitStyle;
}

export async function saveStoredState(state: StoredState): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("[SignalStack] SecureStore write failed.", error);
    throw error;
  }
}

function mergeProviderConfig(
  defaults: ProviderConfig,
  stored: Partial<ProviderConfig> | undefined,
): ProviderConfig {
  if (!stored || typeof stored !== "object") return defaults;
  return {
    mode: typeof stored.mode === "string" ? stored.mode : defaults.mode,
    apiKey: typeof stored.apiKey === "string" ? stored.apiKey : DEFAULT_PROVIDER_CONFIG.apiKey,
    adminKey: typeof stored.adminKey === "string" ? stored.adminKey : DEFAULT_PROVIDER_CONFIG.adminKey,
    workspaceId:
      typeof stored.workspaceId === "string" ? stored.workspaceId : DEFAULT_PROVIDER_CONFIG.workspaceId,
    requestsPerMinuteLimit:
      typeof stored.requestsPerMinuteLimit === "string"
        ? stored.requestsPerMinuteLimit
        : DEFAULT_PROVIDER_CONFIG.requestsPerMinuteLimit,
    tokensPerMinuteLimit:
      typeof stored.tokensPerMinuteLimit === "string"
        ? stored.tokensPerMinuteLimit
        : DEFAULT_PROVIDER_CONFIG.tokensPerMinuteLimit,
    monthlyBudgetUsd:
      typeof stored.monthlyBudgetUsd === "string"
        ? stored.monthlyBudgetUsd
        : DEFAULT_PROVIDER_CONFIG.monthlyBudgetUsd,
  };
}
