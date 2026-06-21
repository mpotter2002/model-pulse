import { signalStackWidget } from "@/widgets/signal-stack-widget";
import { PROVIDERS, PROVIDER_ORDER } from "@/lib/providers";
import type { ProviderId, ProviderSnapshot } from "@/types/domain";

type SnapshotMap = Record<ProviderId, ProviderSnapshot>;

export async function syncSignalStackWidget(snapshots: SnapshotMap) {
  const totalSpend = PROVIDER_ORDER.reduce((sum, providerId) => sum + snapshots[providerId].usage.monthlySpendUsd, 0);
  const cards = PROVIDER_ORDER.map((providerId) => ({
    id: providerId,
    label: PROVIDERS[providerId].label.split(" / ")[0],
    status: snapshots[providerId].statusLabel,
    metric: snapshots[providerId].balanceLabel ?? `$${snapshots[providerId].usage.monthlySpendUsd.toFixed(2)}`,
    accent: PROVIDERS[providerId].accent,
  }));

  await signalStackWidget.updateTimeline([
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
}
