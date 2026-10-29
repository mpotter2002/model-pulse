import type { NotificationPrefs, ProviderConfig, ProviderId, ProviderSnapshot, StoredState } from "@/types/domain";

export const PROVIDER_ORDER: ProviderId[] = ["openai", "anthropic", "kimi", "opencode", "openrouter", "fal"];

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
  opencode: {
    label: "OpenCode Zen",
    accent: "#FF7A59",
    connectionHint: "A Zen API key can be saved, but Zen does not currently publish account spend, credit, or usage telemetry through its public API.",
  },
  openrouter: {
    label: "OpenRouter",
    accent: "#8B9DFF",
    connectionHint: "A standard API key reports totals; an optional management key adds a per-model activity breakdown.",
  },
  fal: {
    label: "fal.ai",
    accent: "#F04E23",
    connectionHint: "An Admin API key reports month-to-date API cost and the workspace credit balance.",
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


export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  thresholds: [50, 80, 90],
  subscriptionAlerts: true,
  apiBudgetAlerts: true,
  resetAlerts: true,
};

export const DEFAULT_STORED_STATE: StoredState = {
  themeMode: "system",
  appIconMode: "system",
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  rateLimitStyle: "bar",
  modelCardOrder: ["openai", "anthropic", "kimi", "minimax", "zai", "gemini", "elevenlabs", "poe", "codebuff", "copilot", "chutes", "factory", "opencode", "openrouter", "fal"],
  hiddenModelCardIds: [],
  homeCardSource: {},
  widgetConfig: {
    headline: "Model Pulse",
    metricMode: "api",
    visibleProviderIds: ["openai", "anthropic", "kimi"],
    visibleModelCardIds: ["openai", "anthropic", "kimi", "minimax", "zai", "gemini", "elevenlabs", "poe", "codebuff", "copilot", "chutes", "factory", "opencode", "openrouter", "fal"],
    focusedModelCardId: "openai",
    subscriptionPricesUsd: {
      openai: "",
      anthropic: "",
      kimi: "",
      minimax: "",
      zai: "",
      gemini: "",
      elevenlabs: "",
      poe: "",
      codebuff: "",
      copilot: "",
      chutes: "",
      factory: "",
      opencode: "",
      openrouter: "",
      fal: "",
    },
  },
  providerConfigs: {
    openai: { ...DEFAULT_PROVIDER_CONFIG, mode: "openai-admin" },
    anthropic: { ...DEFAULT_PROVIDER_CONFIG, mode: "anthropic-manual" },
    kimi: { ...DEFAULT_PROVIDER_CONFIG, mode: "kimi-manual" },
    opencode: { ...DEFAULT_PROVIDER_CONFIG, mode: "opencode-zen-api" },
    openrouter: { ...DEFAULT_PROVIDER_CONFIG, mode: "openrouter-api" },
    fal: { ...DEFAULT_PROVIDER_CONFIG, mode: "fal-admin" },
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

  if (providerId === "openrouter") {
    return {
      mode: "demo",
      statusLabel: "API key needed",
      note: "OpenRouter can report month-to-date credit usage and a key-level spending cap from a standard API key.",
      usage: {
        tokensUsed: 0,
        requestsUsed: 0,
        monthlySpendUsd: 0,
        windowLabel: "Month-to-date",
        tokensAvailable: false,
        requestsAvailable: false,
      },
      limits: {
        requestsPerMinuteLimit: null,
        requestsRemaining: null,
        tokensPerMinuteLimit: null,
        resetsAtLabel: null,
      },
      balanceLabel: null,
      updatedAtLabel,
    };
  }

  if (providerId === "opencode") {
    return {
      mode: "demo",
      statusLabel: "Zen API key needed",
      note: "Add an OpenCode Zen API key to save the connection. Zen does not currently expose account usage, credit balance, or rate-limit telemetry through its public API.",
      usage: {
        tokensUsed: 0,
        requestsUsed: 0,
        monthlySpendUsd: 0,
        windowLabel: "Not reported by Zen",
        spendAvailable: false,
        tokensAvailable: false,
        requestsAvailable: false,
      },
      limits: {
        requestsPerMinuteLimit: null,
        requestsRemaining: null,
        tokensPerMinuteLimit: null,
        resetsAtLabel: null,
      },
      balanceLabel: null,
      updatedAtLabel,
    };
  }

  if (providerId === "fal") {
    return {
      mode: "demo",
      statusLabel: "Admin key needed",
      note: "fal.ai can report month-to-date API cost and workspace credits from an Admin API key.",
      usage: {
        tokensUsed: 0,
        requestsUsed: 0,
        monthlySpendUsd: 0,
        windowLabel: "Month-to-date",
        tokensAvailable: false,
        requestsAvailable: false,
      },
      limits: {
        requestsPerMinuteLimit: null,
        requestsRemaining: null,
        tokensPerMinuteLimit: null,
        resetsAtLabel: null,
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
