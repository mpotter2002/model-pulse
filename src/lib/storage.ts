import * as SecureStore from "expo-secure-store";

import { DEFAULT_PROVIDER_CONFIG, DEFAULT_STORED_STATE, PROVIDER_ORDER } from "@/lib/providers";
import type { ProviderConfig, ProviderId, StoredState } from "@/types/domain";

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
      demoMode: typeof parsed.demoMode === "boolean" ? parsed.demoMode : DEFAULT_STORED_STATE.demoMode,
      themeMode: (typeof parsed.themeMode === "string" && ["light", "dark", "system"].includes(parsed.themeMode)) ? parsed.themeMode : DEFAULT_STORED_STATE.themeMode,
      providerConfigs,
    };
  } catch (error) {
    console.warn("[SignalStack] Stored state was invalid JSON; resetting.", error);
    return DEFAULT_STORED_STATE;
  }
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
  };
}
