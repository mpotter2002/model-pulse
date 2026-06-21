import { Widget } from "expo-widgets";

import { PROVIDERS, PROVIDER_ORDER } from "@/lib/providers";
import type { ProviderId, ProviderSnapshot } from "@/types/domain";

type SnapshotMap = Record<ProviderId, ProviderSnapshot>;

let widgetInstance: Widget | null = null;
let warnedMissing = false;

function getWidget() {
  if (!widgetInstance) {
    try {
      widgetInstance = new Widget("SignalStackWidget", (() => null) as any);
    } catch (error) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn("[SignalStack] Widget native module unavailable; skipping widget sync.", error);
      }
    }
  }
  return widgetInstance;
}

export async function syncSignalStackWidget(snapshots: SnapshotMap) {
  const widget = getWidget();
  if (!widget) return;

  const totalSpend = PROVIDER_ORDER.reduce(
    (sum, providerId) => sum + snapshots[providerId].usage.monthlySpendUsd,
    0,
  );
  const cards = PROVIDER_ORDER.map((providerId) => ({
    id: providerId,
    label: PROVIDERS[providerId].label.split(" / ")[0],
    status: snapshots[providerId].statusLabel,
    metric:
      snapshots[providerId].balanceLabel ??
      `$${snapshots[providerId].usage.monthlySpendUsd.toFixed(2)}`,
    accent: PROVIDERS[providerId].accent,
  }));

  try {
    await widget.updateTimeline([
      {
        date: new Date(),
        props: {
          headline: "SignalStack",
          subheadline: "Usage, limits, and spend",
          totalSpend: `$${totalSpend.toFixed(2)}`,
          updatedAt: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          cards,
        },
      },
    ]);
  } catch (error) {
    console.warn("[SignalStack] Widget timeline update failed:", error);
  }
}
