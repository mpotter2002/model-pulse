import * as Store from "@/lib/background-secure-store";

const KEY = "modelpulse-background-alert-diagnostics-v1";
export interface BackgroundAlertDiagnostics {
  startedAt: number;
  completedAt: number | null;
  outcome: "running" | "completed" | "failed" | "consent-required";
  subscriptionsWithUsage: number;
  apiProvidersChecked: number;
  alertsSent: number;
}

// Only operational counts and timestamps; never credentials or provider responses.
export async function saveBackgroundAlertDiagnostics(value: BackgroundAlertDiagnostics): Promise<void> {
  try {
    await Store.setItemAsync(KEY, JSON.stringify(value));
  } catch {
    // Diagnostics must not block the usage check they describe.
  }
}

export async function loadBackgroundAlertDiagnostics(): Promise<BackgroundAlertDiagnostics | null> {
  const raw = await Store.getItemAsync(KEY);
  if (!raw) return null;
  return JSON.parse(raw) as BackgroundAlertDiagnostics;
}
