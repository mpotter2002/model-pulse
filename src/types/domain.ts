export type ProviderId = "openai" | "anthropic" | "kimi";

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
  statusLabel: string;
  note: string;
  usage: UsageSnapshot;
  limits: LimitSnapshot;
  balanceLabel?: string | null;
  updatedAtLabel: string;
}

export interface StoredState {
  demoMode: boolean;
  providerConfigs: Record<ProviderId, ProviderConfig>;
}
