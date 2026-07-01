import * as SecureStore from "expo-secure-store";

import type { SubscriptionProviderId, SubscriptionUsage } from "@/lib/oauth/types";

function storageKey(providerId: SubscriptionProviderId) {
  return `signalstack-oauth-usage-${providerId}-v1`;
}

export interface PersistedUsage {
  usage: SubscriptionUsage;
  fetchedAt: number;
}

export async function loadPersistedUsage(
  providerId: SubscriptionProviderId,
): Promise<PersistedUsage | null> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(storageKey(providerId));
  } catch (error) {
    console.warn(`[SignalStack] usage read failed for ${providerId}`, error);
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedUsage;
    if (!parsed?.usage || typeof parsed.fetchedAt !== "number") return null;
    return parsed;
  } catch (error) {
    console.warn(`[SignalStack] usage parse failed for ${providerId}`, error);
    return null;
  }
}

export async function savePersistedUsage(
  providerId: SubscriptionProviderId,
  usage: SubscriptionUsage,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      storageKey(providerId),
      JSON.stringify({ usage, fetchedAt: Date.now() } satisfies PersistedUsage),
    );
  } catch (error) {
    console.warn(`[SignalStack] usage save failed for ${providerId}`, error);
  }
}

export async function clearPersistedUsage(providerId: SubscriptionProviderId): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storageKey(providerId));
  } catch (error) {
    console.warn(`[SignalStack] usage clear failed for ${providerId}`, error);
  }
}
