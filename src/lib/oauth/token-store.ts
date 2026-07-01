import * as SecureStore from "expo-secure-store";

import type { StoredTokens, SubscriptionProviderId } from "@/lib/oauth/types";

function storageKey(providerId: SubscriptionProviderId) {
  return `signalstack-oauth-${providerId}-v1`;
}

export async function loadTokens(providerId: SubscriptionProviderId): Promise<StoredTokens | null> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(storageKey(providerId));
  } catch (error) {
    console.warn(`[SignalStack] token read failed for ${providerId}`, error);
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredTokens>;
    if (typeof parsed.accessToken !== "string" || parsed.accessToken.length === 0) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
      idToken: typeof parsed.idToken === "string" ? parsed.idToken : null,
      accountId: typeof parsed.accountId === "string" ? parsed.accountId : null,
      resourceUrl: typeof parsed.resourceUrl === "string" ? parsed.resourceUrl : null,
      scope: typeof parsed.scope === "string" ? parsed.scope : null,
      clientId: typeof parsed.clientId === "string" ? parsed.clientId : null,
      clientSecret: typeof parsed.clientSecret === "string" ? parsed.clientSecret : null,
    };
  } catch (error) {
    console.warn(`[SignalStack] token parse failed for ${providerId}`, error);
    return null;
  }
}

export async function saveTokens(providerId: SubscriptionProviderId, tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(storageKey(providerId), JSON.stringify(tokens));
}

export async function clearTokens(providerId: SubscriptionProviderId): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storageKey(providerId));
  } catch (error) {
    console.warn(`[SignalStack] token clear failed for ${providerId}`, error);
  }
}
