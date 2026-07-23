import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

import { SUBSCRIPTION_PROVIDERS } from "@/lib/oauth/providers";
import type { SubscriptionProviderId, SubscriptionUsage } from "@/lib/oauth/types";
import { PROVIDERS } from "@/lib/providers";
import type { NotificationPrefs, ProviderId, ProviderSnapshot } from "@/types/domain";

const ALERT_STATE_KEY = "modelpulse-notification-alerts-v1";

/**
 * Show alerts even when the app is in the foreground (banner + list, with
 * sound). Called once at startup from the root layout's module scope.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function getNotificationPermission(): Promise<"granted" | "denied" | "undetermined"> {
  const perms = await Notifications.getPermissionsAsync();
  if (perms.granted) return "granted";
  return perms.canAskAgain ? "undetermined" : "denied";
}

/** Ask for permission in context (user toggled alerts on). Returns granted?. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

interface AlertMetric {
  key: string;
  title: string;
  percent: number;
  /** Extra context appended to the body (reset hint or spend-vs-budget). */
  detail: string | null;
}

/** metric key -> thresholds already fired for the current window instance. */
type FiredMap = Record<string, number[]>;

async function loadFired(): Promise<FiredMap> {
  try {
    const raw = await SecureStore.getItemAsync(ALERT_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FiredMap;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveFired(map: FiredMap): Promise<void> {
  try {
    await SecureStore.setItemAsync(ALERT_STATE_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("[ModelPulse] notification alert-state save failed", error);
  }
}

export interface EvaluateUsageAlertsArgs {
  prefs: NotificationPrefs;
  apiSnapshots: Partial<Record<ProviderId, ProviderSnapshot>>;
  subscriptionUsages: Array<{ providerId: SubscriptionProviderId; usage: SubscriptionUsage }>;
}

/**
 * Compare current usage against the user's thresholds and fire a local
 * notification for each metric that newly crosses one. Safe to call from the
 * foreground refresh path and from the background task.
 *
 * Dedupe: each metric fires a given threshold once per window instance. When
 * usage drops back below the lowest fired threshold (window reset), the
 * metric's fired set clears so the next climb notifies again. If a refresh
 * jumps several thresholds at once only the highest one notifies (the rest
 * are marked fired) so the user isn't spammed with stacked alerts.
 *
 * Returns the number of notifications delivered.
 */
export async function evaluateUsageAlerts(args: EvaluateUsageAlertsArgs): Promise<number> {
  const { prefs } = args;
  if (!prefs.enabled) return 0;
  if ((await getNotificationPermission()) !== "granted") return 0;
  const thresholds = [...prefs.thresholds].sort((a, b) => a - b);
  if (thresholds.length === 0) return 0;

  const metrics: AlertMetric[] = [];

  if (prefs.subscriptionAlerts) {
    for (const { providerId, usage } of args.subscriptionUsages) {
      const short = SUBSCRIPTION_PROVIDERS[providerId]?.shortLabel ?? providerId;
      for (const row of usage.limits) {
        if (row.percentUsed === null) continue;
        metrics.push({
          key: `sub:${providerId}:${row.label.toLowerCase()}`,
          title: `${short} · ${row.label}`,
          percent: Math.round(row.percentUsed),
          detail: row.resetHint,
        });
      }
    }
  }

  if (prefs.apiBudgetAlerts) {
    for (const [providerId, snapshot] of Object.entries(args.apiSnapshots)) {
      if (!snapshot || snapshot.mode !== "live") continue;
      const budget = snapshot.monthlyBudgetUsd ?? null;
      const spend = snapshot.usage?.monthlySpendUsd;
      if (!budget || budget <= 0 || typeof spend !== "number") continue;
      metrics.push({
        key: `api-budget:${providerId}`,
        title: `${PROVIDERS[providerId as ProviderId]?.label ?? providerId} API budget`,
        percent: Math.round((spend / budget) * 100),
        detail: `$${spend.toFixed(2)} of your $${budget.toFixed(2)} monthly budget`,
      });
    }
  }

  const fired = await loadFired();
  let sent = 0;

  for (const metric of metrics) {
    let already = fired[metric.key] ?? [];
    if (already.length > 0 && metric.percent < Math.min(...already) - 5) {
      // Window reset: usage fell well below the lowest fired threshold. Tell
      // the user their limit is back to full, but only for subscription
      // windows they actually got an alert on (avoids noise for windows they
      // never came close to hitting).
      if (prefs.resetAlerts && metric.key.startsWith("sub:")) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${metric.title} · reset`,
              body:
                `Rate limit reset — back to full (${metric.percent}% used).` +
                (metric.detail ? ` ${metric.detail}.` : ""),
              sound: true,
            },
            trigger: null,
          });
          sent += 1;
        } catch (error) {
          console.warn("[ModelPulse] failed to deliver reset alert", error);
        }
      }
      already = [];
    }
    const newlyCrossed = thresholds.filter((t) => metric.percent >= t && !already.includes(t));
    if (newlyCrossed.length === 0) {
      if (already.length !== (fired[metric.key] ?? []).length) fired[metric.key] = already;
      continue;
    }
    const highest = newlyCrossed[newlyCrossed.length - 1];
    fired[metric.key] = [...new Set([...already, ...newlyCrossed])].sort((a, b) => a - b);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: metric.title,
          body:
            `${metric.percent}% used — past your ${highest}% alert.` +
            (metric.detail ? ` ${metric.detail}.` : ""),
          sound: true,
        },
        trigger: null, // deliver immediately
      });
      sent += 1;
    } catch (error) {
      console.warn("[ModelPulse] failed to deliver usage alert", error);
    }
  }

  await saveFired(fired);
  return sent;
}
