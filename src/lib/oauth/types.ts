export type SubscriptionProviderId =
  | "kimi-sub"
  | "minimax-sub"
  | "zai-sub"
  | "claude-sub"
  | "codex-sub"
  | "gemini-sub"
  | "elevenlabs-sub"
  | "poe-sub"
  | "codebuff-sub"
  | "copilot-sub"
  | "chutes-sub"
  | "factory-sub"
  | "opencode-sub";

export type SubscriptionAuthKind = "device-flow" | "api-token" | "pkce-code";

/**
 * Configuration for a browser-based authorization-code + PKCE login where the
 * provider displays a code for the user to copy/paste back into the app
 * (e.g. Anthropic's claude.ai OAuth flow, the same one Claude Code uses).
 */
export interface PkceCodeFlowConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

/** Configuration for refreshing expired api-token access tokens. */
export interface TokenRefreshConfig {
  tokenUrl: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  /**
   * Request encoding for the refresh_token grant. OAuth 2 servers default to
   * "form" (application/x-www-form-urlencoded). Anthropic's token endpoint
   * expects a JSON body, so Claude uses "json".
   */
  bodyFormat?: "form" | "json";
}

export interface UsageLimitRow {
  label: string;
  used: number | null;
  limit: number | null;
  percentUsed: number | null;
  resetHint: string | null;
}

export interface SubscriptionUsage {
  summary: UsageLimitRow | null;
  limits: UsageLimitRow[];
  planLabel: string | null;
  fetchState?: "live" | "rate_limited";
  cooldownUntil?: number | null;
  /** Raw diagnostic detail (e.g. last HTTP status / retry-after / server message). */
  debugDetail?: string | null;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  idToken?: string | null;
  accountId?: string | null;
  resourceUrl?: string | null;
  scope?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresIn: number | null;
  interval: number;
}

export type DevicePollResult =
  | { kind: "pending" }
  | { kind: "slow-down" }
  | { kind: "success"; tokens: StoredTokens }
  | { kind: "denied"; message?: string }
  | { kind: "expired" };
