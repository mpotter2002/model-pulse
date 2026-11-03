import * as Notifications from "expo-notifications";

import type { SubscriptionProviderId } from "@/lib/oauth/types";

const RESET_PREFIX = "modelpulse-reset:";

export interface ResetAlertMetric {
  key: string;
  title: string;
  resetAt: number;
}

/** Cancel only this feature's pending alerts, leaving unrelated notifications alone. */
export async function cancelScheduledResetAlerts(providerId?: SubscriptionProviderId): Promise<void> {
  const prefix = providerId ? `${RESET_PREFIX}sub:${providerId}:` : RESET_PREFIX;
  for (const request of await Notifications.getAllScheduledNotificationsAsync()) {
    if (request.identifier.startsWith(prefix)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}

/**
 * iOS owns these date triggers once scheduled, so delivery does not require a
 * background JS refresh. Reconcile only observed metrics: a failed provider
 * fetch must not discard its previously scheduled reminder.
 */
export async function syncScheduledResetAlerts(
  observedKeys: string[],
  reminders: ResetAlertMetric[],
): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const desired = new Map(reminders.map((metric) => [
    `${RESET_PREFIX}${metric.key}:${metric.resetAt}`,
    metric,
  ]));
  const existing = new Set<string>();
  const observed = new Set(observedKeys);
  for (const request of pending) {
    if (!request.identifier.startsWith(RESET_PREFIX)) continue;
    const metricKey = request.content.data?.metricKey;
    if (desired.has(request.identifier)) {
      existing.add(request.identifier);
    } else if (typeof metricKey === "string" && observed.has(metricKey)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  for (const [identifier, metric] of desired) {
    if (existing.has(identifier) || metric.resetAt <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: `${metric.title} · reset`,
        body: "Your provider's scheduled rate-limit reset time has arrived. Open Model Pulse to check your latest usage.",
        sound: true,
        data: { metricKey: metric.key, resetAt: metric.resetAt },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(metric.resetAt),
      },
    });
  }
}
