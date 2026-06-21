import { PROVIDERS, PROVIDER_ORDER } from "@/lib/providers";
import type { ProviderId, ProviderSnapshot } from "@/types/domain";

type SnapshotMap = Record<ProviderId, ProviderSnapshot>;

let widgetModulePromise: Promise<{ signalStackWidget?: any } | null> | null = null;
let warnedMissing = false;

async function loadWidgetModule() {
  if (!widgetModulePromise) {
    widgetModulePromise = (async () => {
      try {
        // Lazy import so the JS app still boots when the native widget
        // module / @expo/ui isn't linked (Expo Go, web, JS-only dev client).
        const mod = await import("@/widgets/signal-stack-widget");
        return mod as { signalStackWidget?: any };
      } catch (error) {
        if (!warnedMissing) {
          warnedMissing = true;
          console.warn(
            "[SignalStack] Native widget bridge unavailable; skipping widget sync.",
            error instanceof Error ? error.message : error,
          );
        }
        return null;
      }
    })();
  }
  return widgetModulePromise;
}

export async function syncSignalStackWidget(snapshots: SnapshotMap) {
  const mod = await loadWidgetModule();
  const widget = mod?.signalStackWidget;
  if (!widget?.updateTimeline) {
    return;
  }

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
    console.warn(
      "[SignalStack] Widget timeline update failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
