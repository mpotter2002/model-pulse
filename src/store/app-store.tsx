import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, useColorScheme } from "react-native";

import { tokens, type ThemeTokens } from "@/design-system/tokens";
import { buildSnapshot } from "@/lib/provider-clients";
import { DEFAULT_STORED_STATE, PROVIDER_ORDER, demoSnapshot } from "@/lib/providers";
import { getConnectionStatus } from "@/lib/oauth/manager";
import { SUBSCRIPTION_PROVIDER_ORDER } from "@/lib/oauth/providers";
import { loadStoredState, saveStoredState } from "@/lib/storage";
import type { HomeCardSource, ModelCardId, ProviderConfig, ProviderId, ProviderSnapshot, RateLimitStyle, StoredState, ThemeMode, WidgetConfig } from "@/types/domain";

const AppStoreContext = React.createContext<AppStoreValue | null>(null);
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const lightTheme = tokens.light;
const darkTheme = tokens.dark;

type Theme = ThemeTokens;

interface AppStoreValue {
  hydrated: boolean;
  refreshing: boolean;
  themeMode: ThemeMode;
  rateLimitStyle: RateLimitStyle;
  providerConfigs: Record<ProviderId, ProviderConfig>;
  modelCardOrder: ModelCardId[];
  hiddenModelCardIds: ModelCardId[];
  homeCardSource: StoredState["homeCardSource"];
  widgetConfig: WidgetConfig;
  snapshots: Record<ProviderId, ProviderSnapshot>;
  theme: Theme;
  setThemeMode: (value: ThemeMode) => Promise<void>;
  setRateLimitStyle: (value: RateLimitStyle) => Promise<void>;
  saveProviderConfig: (providerId: ProviderId, config: ProviderConfig) => Promise<void>;
  updateModelCardPreferences: (next: { order?: ModelCardId[]; hidden?: ModelCardId[] }) => Promise<void>;
  setHomeCardSource: (cardId: ModelCardId, source: HomeCardSource) => Promise<void>;
  updateWidgetConfig: (config: WidgetConfig) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshProvider: (providerId: ProviderId) => Promise<void>;
}

export function AppStoreProvider({ children }: React.PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storedState, setStoredState] = useState<StoredState>(DEFAULT_STORED_STATE);
  const storedStateRef = useRef<StoredState>(DEFAULT_STORED_STATE);
  const lastRefreshAtRef = useRef(0);
  const [snapshots, setSnapshots] = useState<Record<ProviderId, ProviderSnapshot>>({
    openai: demoSnapshot("openai"),
    anthropic: demoSnapshot("anthropic"),
    kimi: demoSnapshot("kimi"),
  });

  const theme = useMemo<Theme>(() => {
    const mode = storedState.themeMode;
    const isDark = mode === "dark" || (mode === "system" && systemColorScheme === "dark");
    return isDark ? darkTheme : lightTheme;
  }, [storedState.themeMode, systemColorScheme]);

  useEffect(() => {
    loadStoredState()
      .then((next) => {
        storedStateRef.current = next;
        // Commit the loaded state and the hydrated flag in the same render so
        // effects gated on `hydrated` (widget sync, refresh) never observe the
        // default state (e.g. rateLimitStyle "bar") after a cold launch.
        setStoredState(next);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, []);

  useEffect(() => {
    storedStateRef.current = storedState;
  }, [storedState]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshAllInternal(storedStateRef.current);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (Platform.OS !== "ios") return;
    void import("@/widgets/widget-sync").then(({ syncSignalStackWidget }) => {
      void syncSignalStackWidget(snapshots, storedState.widgetConfig, storedState.rateLimitStyle);
    });
  }, [hydrated, snapshots, storedState.widgetConfig, storedState.rateLimitStyle]);

  useEffect(() => {
    if (!hydrated) return;
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void refreshAllInternal(storedStateRef.current);
    }, AUTO_REFRESH_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (Date.now() - lastRefreshAtRef.current >= AUTO_REFRESH_MS) {
        void refreshAllInternal(storedStateRef.current);
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [hydrated]);

  async function refreshAllInternal(nextState: StoredState, force = false) {
    setRefreshing(true);
    try {
      const entries = await Promise.all(
        PROVIDER_ORDER.map(async (providerId) => {
          try {
            const snapshot = await buildSnapshot(providerId, nextState.providerConfigs[providerId]);
            return [providerId, snapshot] as const;
          } catch (error) {
            return [
              providerId,
              {
                ...demoSnapshot(providerId),
                mode: "failed",
                statusLabel: "Refresh failed",
                note: error instanceof Error ? error.message : "Unknown provider error",
                updatedAtLabel: "Failed",
                lastError: error instanceof Error ? error.message : "Unknown provider error",
              },
            ] as const;
          }
        }),
      );

      setSnapshots({
        openai: entries[0][1],
        anthropic: entries[1][1],
        kimi: entries[2][1],
      });
      lastRefreshAtRef.current = Date.now();

      // Warm subscription usage (Claude, ChatGPT, Gemini, ...). Each provider's
      // min-fetch interval + cooldown is enforced inside the manager, so this
      // is a no-op network-wise until a provider is actually due. Without this,
      // subscription usage only ever refreshed on the manual button.
      // On an explicit user refresh, force a real network fetch (bypassing the
      // per-provider min-fetch interval and any self-imposed cooldown) so
      // Claude's throttled usage endpoint actually updates. Automatic warms
      // (mount, app-active) stay non-forced so background focus can't reignite
      // Anthropic's penalty.
      await Promise.all(
        SUBSCRIPTION_PROVIDER_ORDER.map((id) =>
          getConnectionStatus(id, { allowNetwork: true, force }).catch(() => undefined),
        ),
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function commitStoredState(buildNext: (current: StoredState) => StoredState) {
    const previous = storedStateRef.current;
    const nextState = buildNext(previous);
    storedStateRef.current = nextState;
    setStoredState(nextState);
    try {
      await saveStoredState(nextState);
    } catch (error) {
      storedStateRef.current = previous;
      setStoredState(previous);
      throw error;
    }
  }

  const value: AppStoreValue = {
    hydrated,
    refreshing,
    themeMode: storedState.themeMode,
    rateLimitStyle: storedState.rateLimitStyle,
    providerConfigs: storedState.providerConfigs,
    modelCardOrder: storedState.modelCardOrder,
    hiddenModelCardIds: storedState.hiddenModelCardIds,
    widgetConfig: storedState.widgetConfig,
    homeCardSource: storedState.homeCardSource,
    snapshots,
    theme,
    setThemeMode: async (value) => {
      await commitStoredState((current) => ({ ...current, themeMode: value }));
    },
    setRateLimitStyle: async (value) => {
      await commitStoredState((current) => ({ ...current, rateLimitStyle: value }));
    },
    saveProviderConfig: async (providerId, config) => {
      await commitStoredState((current) => ({
        ...current,
        providerConfigs: {
          ...current.providerConfigs,
          [providerId]: config,
        },
      }));
    },
    updateModelCardPreferences: async (next) => {
      await commitStoredState((current) => ({
        ...current,
        modelCardOrder: next.order ?? current.modelCardOrder,
        hiddenModelCardIds: next.hidden ?? current.hiddenModelCardIds,
      }));
    },
    setHomeCardSource: async (cardId, source) => {
      await commitStoredState((current) => ({
        ...current,
        homeCardSource: { ...current.homeCardSource, [cardId]: source },
      }));
    },
    updateWidgetConfig: async (config) => {
      await commitStoredState((current) => ({ ...current, widgetConfig: config }));
    },
    refreshAll: async () => {
      await refreshAllInternal(storedState, true);
    },
    refreshProvider: async (providerId) => {
      setRefreshing(true);
      try {
        // Read from the ref, not the render closure, so a refresh fired right
        // after saving config uses the values that were just persisted.
        const snapshot = await buildSnapshot(providerId, storedStateRef.current.providerConfigs[providerId]);
        setSnapshots((current) => ({
          ...current,
          [providerId]: snapshot,
        }));
        lastRefreshAtRef.current = Date.now();
      } catch (error) {
        setSnapshots((current) => ({
          ...current,
          [providerId]: {
            ...current[providerId],
            mode: "failed",
            statusLabel: "Refresh failed",
            note: error instanceof Error ? error.message : "Unknown provider error",
            updatedAtLabel: "Failed",
            lastError: error instanceof Error ? error.message : "Unknown provider error",
          },
        }));
      } finally {
        setRefreshing(false);
      }
    },
  };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = React.use(AppStoreContext);
  if (!value) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }

  return value;
}
