import * as SecureStore from "expo-secure-store";

import type { SubscriptionProviderId } from "@/lib/oauth/types";

function key(providerId: SubscriptionProviderId) {
  return `signalstack-oauth-cooldown-${providerId}-v1`;
}

export async function loadCooldownUntil(
  providerId: SubscriptionProviderId,
): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(key(providerId));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveCooldownUntil(
  providerId: SubscriptionProviderId,
  cooldownUntil: number,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(key(providerId), String(cooldownUntil));
  } catch {
    // best effort
  }
}

export async function clearCooldown(providerId: SubscriptionProviderId): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key(providerId));
  } catch {
    // best effort
  }
}
