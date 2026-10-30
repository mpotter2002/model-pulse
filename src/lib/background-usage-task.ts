import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";
import * as TaskManager from "expo-task-manager";

import { evaluateUsageAlerts } from "@/lib/notifications";
import { saveBackgroundAlertDiagnostics, type BackgroundAlertDiagnostics } from "@/lib/notification-diagnostics";
import { getConnectionStatus } from "@/lib/oauth/manager";
import { SUBSCRIPTION_PROVIDER_ORDER } from "@/lib/oauth/providers";
import { isProviderDataSharingAllowed } from "@/lib/provider-data-sharing";
import type { SubscriptionProviderId, SubscriptionUsage } from "@/lib/oauth/types";
import { buildSnapshot } from "@/lib/provider-clients";
import { PROVIDER_ORDER, demoSnapshot } from "@/lib/providers";
import { loadStoredState } from "@/lib/storage";
import type { ProviderId, ProviderSnapshot } from "@/types/domain";

export const USAGE_ALERT_TASK = "model-pulse-usage-alerts";

/**
 * Periodic background refresh: pull the latest usage, then evaluate alert
 * thresholds. Defined at module scope (imported by the root layout via the
 * store) so it is registered before iOS can deliver a task event on a
 * headless launch. iOS decides when this actually runs (battery/network
 * permitting) — the 15-minute minimum interval is a hint, not a schedule.
 */
TaskManager.defineTask(USAGE_ALERT_TASK, async () => {
  const diagnostics: BackgroundAlertDiagnostics = {
    startedAt: Date.now(), completedAt: null, outcome: "running",
    subscriptionsWithUsage: 0, apiProvidersChecked: 0, alertsSent: 0,
  };
  await saveBackgroundAlertDiagnostics(diagnostics);
  try {
    if (!(await isProviderDataSharingAllowed())) {
      await saveBackgroundAlertDiagnostics({ ...diagnostics, outcome: "consent-required", completedAt: Date.now() });
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Never overwrite the widget with default API settings after a temporary
    // Keychain read failure. Keep its last timeline until settings are readable.
    const state = await loadStoredState({ strict: true });

    const apiSnapshots: Partial<Record<ProviderId, ProviderSnapshot>> = {};
    const subscriptionUsages: Array<{ providerId: SubscriptionProviderId; usage: SubscriptionUsage }> = [];
    // Start subscriptions immediately, alongside API reports. Deliver each
    // provider's alerts as it finishes so one slow endpoint cannot block Claude.
    await Promise.all([
      ...PROVIDER_ORDER.map(async (providerId) => {
        try {
          const snapshot = await buildSnapshot(providerId, state.providerConfigs[providerId]);
          apiSnapshots[providerId] = snapshot;
          if (snapshot.mode === "live") diagnostics.apiProvidersChecked += 1;
          if (state.notificationPrefs.enabled) diagnostics.alertsSent += await evaluateUsageAlerts({
            prefs: state.notificationPrefs, apiSnapshots: { [providerId]: snapshot }, subscriptionUsages: [],
          });
        } catch {
          // Preserve other providers' checks when this provider fails.
        }
      }),
      ...SUBSCRIPTION_PROVIDER_ORDER.map(async (providerId) => {
        try {
          const status = await getConnectionStatus(providerId, { allowNetwork: true });
          if (status.kind !== "connected") return;
          subscriptionUsages.push({ providerId, usage: status.usage });
          if (status.usage.limits.length > 0) diagnostics.subscriptionsWithUsage += 1;
          if (state.notificationPrefs.enabled) diagnostics.alertsSent += await evaluateUsageAlerts({
            prefs: state.notificationPrefs, apiSnapshots: {}, subscriptionUsages: [{ providerId, usage: status.usage }],
          });
        } catch {
          // Preserve other providers' checks when this provider fails.
        }
      }),
    ]);

    // Keep the Home Screen widget fresh even when the user never opens the app.
    if (Platform.OS === "ios") {
      try {
        const { syncSignalStackWidget } = await import("@/widgets/widget-sync");
        const snapshots = Object.fromEntries(
          PROVIDER_ORDER.map((providerId) => [
            providerId,
            apiSnapshots[providerId] ?? demoSnapshot(providerId),
          ]),
        ) as Record<ProviderId, ProviderSnapshot>;
        await syncSignalStackWidget(snapshots, state.widgetConfig, state.rateLimitStyle, state.hiddenModelCardIds);
      } catch (error) {
        console.warn("[ModelPulse] background widget sync failed", error);
      }
    }

    await saveBackgroundAlertDiagnostics({ ...diagnostics, completedAt: Date.now(), outcome: "completed" });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    await saveBackgroundAlertDiagnostics({ ...diagnostics, completedAt: Date.now(), outcome: "failed" });
    console.warn("[ModelPulse] background usage task failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Register the periodic task (idempotent). Called when alerts are enabled. */
export async function registerUsageAlertTask(): Promise<void> {
  // Re-register to update existing installations' former 60-minute hint.
  // iOS still chooses execution time; this is not a delivery guarantee.
  await BackgroundTask.registerTaskAsync(USAGE_ALERT_TASK, { minimumInterval: 15 });
}

export async function unregisterUsageAlertTask(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(USAGE_ALERT_TASK).catch(() => false);
  if (registered) {
    await BackgroundTask.unregisterTaskAsync(USAGE_ALERT_TASK);
  }
}
