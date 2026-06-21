import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { buildSnapshot } from "@/lib/provider-clients";
import { DEFAULT_STORED_STATE, PROVIDER_ORDER, demoSnapshot } from "@/lib/providers";
import { loadStoredState, saveStoredState } from "@/lib/storage";
import { syncSignalStackWidget } from "@/widgets/widget-sync";
import type { ProviderConfig, ProviderId, ProviderSnapshot, StoredState } from "@/types/domain";

const AppStoreContext = React.createContext<AppStoreValue | null>(null);

const lightTheme = {
  background: "#FFFFFF",
  panel: "#FFFFFF",
  subtlePanel: "#F5F5F7",
  chip: "#F5F5F7",
  border: "#E5E5EA",
  text: "#000000",
  muted: "#8E8E93",
  action: "#000000",
  blurTint: "light" as const,
  statusBar: "dark" as const,
};

const darkTheme = {
  background: "#000000",
  panel: "#1C1C1E",
  subtlePanel: "#2C2C2E",
  chip: "#2C2C2E",
  border: "#38383A",
  text: "#FFFFFF",
  muted: "#8E8E93",
  action: "#FFFFFF",
  blurTint: "dark" as const,
  statusBar: "light" as const,
};

type Theme = {
  background: string;
  panel: string;
  subtlePanel: string;
  chip: string;
  border: string;
  text: string;
  muted: string;
  action: string;
  blurTint: "light" | "dark" | "default";
  statusBar: "light" | "dark" | "auto";
};

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
  const colorScheme = useColorScheme();
  const theme = useMemo<Theme>(() => (colorScheme === "dark" ? darkTheme : lightTheme), [colorScheme]);
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
    theme,
    setDemoMode: async (value) => {
      const previous = storedState;
      const nextState = { ...storedState, demoMode: value };
      setStoredState(nextState);
      try {
        await saveStoredState(nextState);
      } catch (error) {
        setStoredState(previous);
        throw error;
      }
    },
    saveProviderConfig: async (providerId, config) => {
      const previous = storedState;
      const nextState = {
        ...storedState,
        providerConfigs: {
          ...storedState.providerConfigs,
          [providerId]: config,
        },
      };
      setStoredState(nextState);
      try {
        await saveStoredState(nextState);
      } catch (error) {
        setStoredState(previous);
        throw error;
      }
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
