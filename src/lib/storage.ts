import * as SecureStore from "expo-secure-store";

import { DEFAULT_STORED_STATE } from "@/lib/providers";
import type { StoredState } from "@/types/domain";

const STORAGE_KEY = "signalstack-state-v1";

export async function loadStoredState() {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return DEFAULT_STORED_STATE;

  try {
    const parsed = JSON.parse(raw) as StoredState;
    return {
      demoMode: parsed.demoMode ?? DEFAULT_STORED_STATE.demoMode,
      providerConfigs: {
        ...DEFAULT_STORED_STATE.providerConfigs,
        ...parsed.providerConfigs,
      },
    };
  } catch {
    return DEFAULT_STORED_STATE;
  }
}

export async function saveStoredState(state: StoredState) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
}
