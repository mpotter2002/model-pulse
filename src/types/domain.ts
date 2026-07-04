export type ProviderId = "openai" | "anthropic" | "kimi";

export type SnapshotMode = "demo" | "live" | "needs-key" | "failed" | "manual" | "subscription";

export type ThemeMode = "light" | "dark" | "system";

export type ModelCardId = "openai" | "anthropic" | "kimi" | "minimax" | "zai" | "gemini" | "elevenlabs" | "poe" | "codebuff" | "copilot" | "chutes" | "factory" | "opencode";

export type WidgetMetricMode = "api" | "subscription";

export type RateLimitStyle = "bar" | "dots" | "dash" | "none";

export interface ProviderConfig {
  mode: string;
  apiKey: string;
  adminKey: string;
  workspaceId: string;
  requestsPerMinuteLimit: string;
  tokensPerMinuteLimit: string;
}

export interface UsageSnapshot {
  tokensUsed: number;
  requestsUsed: number;
  monthlySpendUsd: number;
  windowLabel: string;
}

export interface LimitSnapshot {
  requestsPerMinuteLimit: number | null;
  requestsRemaining: number | null;
  tokensPerMinuteLimit: number | null;
  resetsAtLabel: string | null;
}

export interface ProviderSnapshot {
  mode: SnapshotMode;
  statusLabel: string;
  note: string;
  usage: UsageSnapshot;
  limits: LimitSnapshot;
  balanceLabel?: string | null;
  updatedAtLabel: string;
  lastError?: string | null;
}

export interface StoredState {
  demoMode: boolean;
  themeMode: ThemeMode;
  rateLimitStyle: RateLimitStyle;
  providerConfigs: Record<ProviderId, ProviderConfig>;
  modelCardOrder: ModelCardId[];
  hiddenModelCardIds: ModelCardId[];
  widgetConfig: WidgetConfig;
}

export interface WidgetConfig {
  headline: string;
  metricMode: WidgetMetricMode;
  visibleProviderIds: ProviderId[];
  visibleModelCardIds: ModelCardId[];
  focusedModelCardId: ModelCardId;
  subscriptionPricesUsd: Record<ModelCardId, string>;
}
