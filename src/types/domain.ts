export type ProviderId = "openai" | "anthropic" | "kimi" | "opencode" | "openrouter" | "fal";

export type SnapshotMode = "demo" | "live" | "needs-key" | "failed" | "manual" | "subscription";

export type ThemeMode = "light" | "dark" | "system";

export type AppIconMode = "system" | "light" | "dark";

export type ModelCardId = "openai" | "anthropic" | "kimi" | "minimax" | "zai" | "gemini" | "elevenlabs" | "poe" | "codebuff" | "copilot" | "chutes" | "factory" | "opencode" | "openrouter" | "fal";

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
  /** Alert when a subscription rate-limit window resets back to full. */
  resetAlerts: boolean;
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
  inputCache?: InputCacheUsage;
  tokensUsed: number;
  requestsUsed: number;
  monthlySpendUsd: number;
  windowLabel: string;
  /** False when the provider's telemetry API does not expose monthly spend. */
  spendAvailable?: boolean;
  /** False when the provider's telemetry API does not expose token counts. */
  tokensAvailable?: boolean;
  /** False when the provider's telemetry API does not expose request counts. */
  requestsAvailable?: boolean;
}

export interface InputCacheUsage {
  freshInputTokens: number | null;
  cacheReadTokens: number | null;
  /** OpenAI does not separately report cache writes. */
  cacheWriteTokens: number | null;
  cacheReusePercent: number | null;
  windowLabel: string;
}

export interface LimitSnapshot {
  requestsPerMinuteLimit: number | null;
  requestsRemaining: number | null;
  tokensPerMinuteLimit: number | null;
  resetsAtLabel: string | null;
}

export interface ProviderModelUsage {
  model: string;
  providerName: string | null;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  spendUsd: number;
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
  /** Optional provider-specific activity grouped by model. */
  modelBreakdown?: ProviderModelUsage[];
  modelBreakdownWindowLabel?: string | null;
  modelBreakdownError?: string | null;
}

export interface StoredState {
  themeMode: ThemeMode;
  /** Which app icon variant to show. "system" follows the iPhone appearance. */
  appIconMode: AppIconMode;
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
