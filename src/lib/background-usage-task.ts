import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { evaluateUsageAlerts } from "@/lib/notifications";
import { getConnectionStatus } from "@/lib/oauth/manager";
import { SUBSCRIPTION_PROVIDER_ORDER } from "@/lib/oauth/providers";
import type { SubscriptionProviderId, SubscriptionUsage } from "@/lib/oauth/types";
import { buildSnapshot } from "@/lib/provider-clients";
import { PROVIDER_ORDER } from "@/lib/providers";
import { loadStoredState } from "@/lib/storage";
import type { ProviderId, ProviderSnapshot } from "@/types/domain";

export const USAGE_ALERT_TASK = "model-pulse-usage-alerts";

/**
 * Periodic background refresh: pull the latest usage, then evaluate alert
 * thresholds. Defined at module scope (imported by the root layout via the
 * store) so it is registered before iOS can deliver a task event on a
 * headless launch. iOS decides when this actually runs (battery/network
 * permitting) — the 60-minute minimum interval is a hint, not a schedule.
 */
TaskManager.defineTask(USAGE_ALERT_TASK, async () => {
  try {
    const state = await loadStoredState();
    if (!state.notificationPrefs.enabled) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const apiSnapshots: Partial<Record<ProviderId, ProviderSnapshot>> = {};
    await Promise.all(
      PROVIDER_ORDER.map(async (providerId) => {
        try {
          apiSnapshots[providerId] = await buildSnapshot(providerId, state.providerConfigs[providerId]);
        } catch {
          // A failed provider just skips this round's budget check.
        }
      }),
    );

    const subscriptionUsages: Array<{ providerId: SubscriptionProviderId; usage: SubscriptionUsage }> = [];
    await Promise.all(
      SUBSCRIPTION_PROVIDER_ORDER.map(async (providerId) => {
        try {
          const status = await getConnectionStatus(providerId, { allowNetwork: true });
          if (status.kind === "connected") {
            subscriptionUsages.push({ providerId, usage: status.usage });
          }
        } catch {
          // Skip providers whose fetch failed this round.
        }
      }),
    );

    const sent = await evaluateUsageAlerts({
      prefs: state.notificationPrefs,
      apiSnapshots,
      subscriptionUsages,
    });
    if (sent > 0) console.log(`[ModelPulse] background task delivered ${sent} usage alert(s)`);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn("[ModelPulse] background usage task failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Register the periodic task (idempotent). Called when alerts are enabled. */
export async function registerUsageAlertTask(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(USAGE_ALERT_TASK).catch(() => false);
  if (!registered) {
    await BackgroundTask.registerTaskAsync(USAGE_ALERT_TASK, { minimumInterval: 60 });
  }
}

export async function unregisterUsageAlertTask(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(USAGE_ALERT_TASK).catch(() => false);
  if (registered) {
    await BackgroundTask.unregisterTaskAsync(USAGE_ALERT_TASK);
  }
}
