export type ProviderId = "openai" | "anthropic" | "kimi";

export type SnapshotMode = "demo" | "live" | "needs-key" | "failed" | "manual" | "subscription";

export type ThemeMode = "light" | "dark" | "system";

export type ModelCardId = "openai" | "anthropic" | "kimi" | "minimax" | "zai" | "gemini" | "elevenlabs" | "poe" | "codebuff" | "copilot" | "chutes" | "factory" | "opencode";

export type WidgetMetricMode = "api" | "subscription";

export type HomeCardSource = "subscription" | "api";

export type RateLimitStyle = "bar" | "dots" | "dash" | "none";


export interface NotificationPrefs {
  /** Master switch for all usage alerts. */
  enabled: boolean;
  /** Percent-used thresholds that fire an alert (ascending, 1-100). */
  thresholds: number[];
  /** Alert when a subscription rate-limit window crosses a threshold. */
  subscriptionAlerts: boolean;
  /** Alert when API monthly spend crosses a threshold of the self-set budget. */
  apiBudgetAlerts: boolean;
}

export interface ProviderConfig {
  mode: string;
  apiKey: string;
  adminKey: string;
  workspaceId: string;
  requestsPerMinuteLimit: string;
  tokensPerMinuteLimit: string;
  /** Self-set monthly spend budget (USD) used to draw the API budget bar. */
  monthlyBudgetUsd: string;
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
  /** Copied from ProviderConfig so widget-sync can draw spend-vs-budget bars. */
  monthlyBudgetUsd?: number | null;
}

export interface StoredState {
  themeMode: ThemeMode;
  rateLimitStyle: RateLimitStyle;
  providerConfigs: Record<ProviderId, ProviderConfig>;
  modelCardOrder: ModelCardId[];
  hiddenModelCardIds: ModelCardId[];
  /** Per-card choice of which usage the home screen card leads with. Default: "subscription". */
  homeCardSource: Partial<Record<ModelCardId, HomeCardSource>>;
  /** Usage-alert preferences for local notifications. */
  notificationPrefs: NotificationPrefs;
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
