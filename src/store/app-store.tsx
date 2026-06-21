import React, { startTransition, useEffect, useState } from "react";

import { buildSnapshot } from "@/lib/provider-clients";
import { DEFAULT_STORED_STATE, PROVIDER_ORDER, demoSnapshot } from "@/lib/providers";
import { loadStoredState, saveStoredState } from "@/lib/storage";
import type { ProviderConfig, ProviderId, ProviderSnapshot, StoredState } from "@/types/domain";
import { syncSignalStackWidget } from "@/widgets/widget-sync";

const AppStoreContext = React.createContext<AppStoreValue | null>(null);

const lightTheme = {
  background: "#F4F1EA",
  panel: "#FFFDF8",
  subtlePanel: "#ECE5D8",
  chip: "#E8E0D0",
  border: "#D6C9B2",
  text: "#231B12",
  muted: "#6E6255",
  action: "#9EE6B8",
  shadow: "0 10px 24px rgba(54, 38, 18, 0.08)",
  blurTint: "light" as const,
  statusBar: "dark" as const,
};

type Theme = typeof lightTheme;

interface AppStoreValue {
  hydrated: boolean;
  refreshing: boolean;
  demoMode: boolean;
  providerConfigs: Record<ProviderId, ProviderConfig>;
  snapshots: Record<ProviderId, ProviderSnapshot>;
  theme: Theme;
  setDemoMode: (value: boolean) => Promise<void>;
  saveProviderConfig: (providerId: ProviderId, config: ProviderConfig) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshProvider: (providerId: ProviderId) => Promise<void>;
}

export function AppStoreProvider({ children }: React.PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storedState, setStoredState] = useState<StoredState>(DEFAULT_STORED_STATE);
  const [snapshots, setSnapshots] = useState<Record<ProviderId, ProviderSnapshot>>({
    openai: demoSnapshot("openai"),
    anthropic: demoSnapshot("anthropic"),
    kimi: demoSnapshot("kimi"),
  });

  useEffect(() => {
    loadStoredState()
      .then((next) => {
        startTransition(() => {
          setStoredState(next);
        });
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshAllInternal(storedState);
  }, [hydrated, storedState.demoMode]);

  useEffect(() => {
    if (!hydrated) return;
    void syncSignalStackWidget(snapshots);
  }, [hydrated, snapshots]);

  async function refreshAllInternal(nextState: StoredState) {
    setRefreshing(true);
    try {
      const entries = await Promise.all(
        PROVIDER_ORDER.map(async (providerId) => {
          try {
            const snapshot = await buildSnapshot(providerId, nextState.providerConfigs[providerId], nextState.demoMode);
            return [providerId, snapshot] as const;
          } catch (error) {
            return [
              providerId,
              {
                ...demoSnapshot(providerId),
                statusLabel: "Refresh failed",
                note: error instanceof Error ? error.message : "Unknown provider error",
                updatedAtLabel: "Failed",
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
    } finally {
      setRefreshing(false);
    }
  }

  const value: AppStoreValue = {
    hydrated,
    refreshing,
    demoMode: storedState.demoMode,
    providerConfigs: storedState.providerConfigs,
    snapshots,
    theme: lightTheme,
    setDemoMode: async (value) => {
      const nextState = { ...storedState, demoMode: value };
      setStoredState(nextState);
      await saveStoredState(nextState);
    },
    saveProviderConfig: async (providerId, config) => {
      const nextState = {
        ...storedState,
        providerConfigs: {
          ...storedState.providerConfigs,
          [providerId]: config,
        },
      };
      setStoredState(nextState);
      await saveStoredState(nextState);
    },
    refreshAll: async () => {
      await refreshAllInternal(storedState);
    },
    refreshProvider: async (providerId) => {
      setRefreshing(true);
      try {
        const snapshot = await buildSnapshot(providerId, storedState.providerConfigs[providerId], storedState.demoMode);
        setSnapshots((current) => ({
          ...current,
          [providerId]: snapshot,
        }));
      } catch (error) {
        setSnapshots((current) => ({
          ...current,
          [providerId]: {
            ...current[providerId],
            statusLabel: "Refresh failed",
            note: error instanceof Error ? error.message : "Unknown provider error",
            updatedAtLabel: "Failed",
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
