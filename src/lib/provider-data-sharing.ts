import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type ProviderDataSharingConsent = "unknown" | "granted" | "declined";

const CONSENT_KEY = "model-pulse-provider-data-sharing-consent-v1";

let cachedConsent: ProviderDataSharingConsent | null = null;

export async function loadProviderDataSharingConsent(): Promise<ProviderDataSharingConsent> {
  if (cachedConsent) return cachedConsent;

  try {
    const stored =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(CONSENT_KEY) ?? null
        : await SecureStore.getItemAsync(CONSENT_KEY);
    cachedConsent = stored === "granted" || stored === "declined" ? stored : "unknown";
  } catch (error) {
    console.warn("[ModelPulse] provider data-sharing consent read failed.", error);
    cachedConsent = "unknown";
  }

  return cachedConsent;
}

export async function setProviderDataSharingConsent(
  consent: Exclude<ProviderDataSharingConsent, "unknown">,
): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(CONSENT_KEY, consent);
  } else {
    await SecureStore.setItemAsync(CONSENT_KEY, consent);
  }
  cachedConsent = consent;
}

export async function isProviderDataSharingAllowed(): Promise<boolean> {
  return (await loadProviderDataSharingConsent()) === "granted";
}

export async function requireProviderDataSharingConsent(): Promise<void> {
  if (!(await isProviderDataSharingAllowed())) {
    throw new Error("Allow provider data sharing before connecting or refreshing provider data.");
  }
}
