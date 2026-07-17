import type { ProviderConfig, ProviderId, ProviderSnapshot, StoredState } from "@/types/domain";

export const PROVIDER_ORDER: ProviderId[] = ["openai", "anthropic", "kimi"];

export const PROVIDERS: Record<
  ProviderId,
  {
    label: string;
    accent: string;
    connectionHint: string;
  }
> = {
  openai: {
    label: "ChatGPT / OpenAI",
    accent: "#72E3AD",
    connectionHint: "Best current path: admin key for org usage and costs, plus optional manual limit caps.",
  },
  anthropic: {
    label: "Anthropic / Claude",
    accent: "#F2B278",
    connectionHint: "Prototype uses stored API credentials and manual caps while live admin reporting is hardened.",
  },
  kimi: {
    label: "Kimi / Moonshot",
    accent: "#91B7FF",
    connectionHint: "Kimi support starts in manual mode because usage telemetry is less standardized than OpenAI.",
  },
};

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  mode: "manual",
  apiKey: "",
  adminKey: "",
  workspaceId: "",
  requestsPerMinuteLimit: "",
  tokensPerMinuteLimit: "",
  monthlyBudgetUsd: "",
};

export const DEFAULT_STORED_STATE: StoredState = {
  demoMode: false,
  themeMode: "system",
  rateLimitStyle: "bar",
  modelCardOrder: ["openai", "anthropic", "kimi", "minimax", "zai", "gemini", "elevenlabs", "poe", "codebuff", "copilot", "chutes", "factory", "opencode"],
  hiddenModelCardIds: [],
  widgetConfig: {
    headline: "Model Pulse",
    metricMode: "api",
    visibleProviderIds: ["openai", "anthropic", "kimi"],
    visibleModelCardIds: ["openai", "anthropic", "kimi", "minimax", "zai", "gemini", "elevenlabs", "poe", "codebuff", "copilot", "chutes", "factory", "opencode"],
    focusedModelCardId: "openai",
    subscriptionPricesUsd: {
      openai: "20",
      anthropic: "20",
      kimi: "",
      minimax: "",
      zai: "",
      gemini: "20",
      elevenlabs: "",
      poe: "",
      codebuff: "",
      copilot: "",
      chutes: "",
      factory: "",
      opencode: "10",
    },
  },
  providerConfigs: {
    openai: { ...DEFAULT_PROVIDER_CONFIG, mode: "openai-admin" },
    anthropic: { ...DEFAULT_PROVIDER_CONFIG, mode: "anthropic-manual" },
    kimi: { ...DEFAULT_PROVIDER_CONFIG, mode: "kimi-manual" },
  },
};

export function demoSnapshot(providerId: ProviderId): ProviderSnapshot {
  const updatedAtLabel = new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (providerId === "openai") {
    return {
      mode: "demo",
      statusLabel: "Healthy burn",
      note: "24h usage is being simulated until an admin key is stored. This maps cleanly to a future widget timeline.",
      usage: {
        tokensUsed: 1_420_000,
        requestsUsed: 964,
        monthlySpendUsd: 78.42,
        windowLabel: "Last 24 hours",
      },
      limits: {
        requestsPerMinuteLimit: 5_000,
        requestsRemaining: 3_880,
        tokensPerMinuteLimit: 2_000_000,
        resetsAtLabel: "Rolling minute",
      },
      balanceLabel: null,
      updatedAtLabel,
    };
  }

  if (providerId === "anthropic") {
    return {
      mode: "demo",
      statusLabel: "Near request cap",
      note: "Claude is trending close to its manual request ceiling. A live refresh path can replace this card once admin reporting is connected.",
      usage: {
        tokensUsed: 890_000,
        requestsUsed: 611,
        monthlySpendUsd: 52.18,
        windowLabel: "Last 24 hours",
      },
      limits: {
        requestsPerMinuteLimit: 1_800,
        requestsRemaining: 140,
        tokensPerMinuteLimit: 400_000,
        resetsAtLabel: "42 sec",
      },
      balanceLabel: null,
      updatedAtLabel,
    };
  }

  return {
    mode: "demo",
    statusLabel: "Manual tracking",
    note: "Kimi is included in the prototype, but its usage pipeline still needs a stronger programmatic source than the major US APIs expose today.",
    usage: {
      tokensUsed: 364_000,
      requestsUsed: 277,
      monthlySpendUsd: 18.73,
      windowLabel: "Last 24 hours",
    },
    limits: {
      requestsPerMinuteLimit: 600,
      requestsRemaining: 298,
      tokensPerMinuteLimit: 128_000,
      resetsAtLabel: "Manual",
    },
    balanceLabel: "$42.10 available",
    updatedAtLabel,
  };
}
