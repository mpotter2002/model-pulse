import type { ProviderId } from "@/types/domain";

export type SubscriptionOAuthStatus = "unavailable" | "scaffolded";

export type SubscriptionOAuthCapability = {
  providerId: ProviderId;
  displayName: string;
  status: SubscriptionOAuthStatus;
  reason: string;
  officialTelemetryAvailable: boolean;
  requiredEnv: string[];
};

export const SUBSCRIPTION_OAUTH_CAPABILITIES: Record<ProviderId, SubscriptionOAuthCapability> = {
  openai: {
    providerId: "openai",
    displayName: "ChatGPT / OpenAI",
    status: "unavailable",
    reason:
      "OpenAI does not expose ChatGPT subscription usage, tokens, or personal rate limits through a public OAuth API. The official telemetry path is API/admin usage.",
    officialTelemetryAvailable: false,
    requiredEnv: [
      "SIGNALSTACK_OPENAI_OAUTH_CLIENT_ID",
      "SIGNALSTACK_OPENAI_OAUTH_CLIENT_SECRET",
      "SIGNALSTACK_OPENAI_OAUTH_AUTHORIZE_URL",
      "SIGNALSTACK_OPENAI_OAUTH_TOKEN_URL",
    ],
  },
  anthropic: {
    providerId: "anthropic",
    displayName: "Anthropic / Claude",
    status: "unavailable",
    reason:
      "Anthropic does not expose Claude Pro subscription usage, tokens, or personal rate limits through a public OAuth API. The official telemetry path is Admin API credentials.",
    officialTelemetryAvailable: false,
    requiredEnv: [
      "SIGNALSTACK_ANTHROPIC_OAUTH_CLIENT_ID",
      "SIGNALSTACK_ANTHROPIC_OAUTH_CLIENT_SECRET",
      "SIGNALSTACK_ANTHROPIC_OAUTH_AUTHORIZE_URL",
      "SIGNALSTACK_ANTHROPIC_OAUTH_TOKEN_URL",
    ],
  },
  kimi: {
    providerId: "kimi",
    displayName: "Kimi / Moonshot",
    status: "unavailable",
    reason:
      "Moonshot/Kimi does not expose personal subscription usage, tokens, or rate limits through a public OAuth telemetry API. The official telemetry path is API key based.",
    officialTelemetryAvailable: false,
    requiredEnv: [
      "SIGNALSTACK_KIMI_OAUTH_CLIENT_ID",
      "SIGNALSTACK_KIMI_OAUTH_CLIENT_SECRET",
      "SIGNALSTACK_KIMI_OAUTH_AUTHORIZE_URL",
      "SIGNALSTACK_KIMI_OAUTH_TOKEN_URL",
    ],
  },
};

export function isProviderId(value: string | null): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "kimi";
}

export function getSubscriptionOAuthEnv(providerId: ProviderId) {
  const prefix = providerId.toUpperCase();
  return {
    clientId: process.env[`SIGNALSTACK_${prefix}_OAUTH_CLIENT_ID`],
    clientSecret: process.env[`SIGNALSTACK_${prefix}_OAUTH_CLIENT_SECRET`],
    authorizeUrl: process.env[`SIGNALSTACK_${prefix}_OAUTH_AUTHORIZE_URL`],
    tokenUrl: process.env[`SIGNALSTACK_${prefix}_OAUTH_TOKEN_URL`],
  };
}

export function missingSubscriptionOAuthEnv(providerId: ProviderId) {
  const env = getSubscriptionOAuthEnv(providerId);
  return SUBSCRIPTION_OAUTH_CAPABILITIES[providerId].requiredEnv.filter((key) => {
    const shortKey = key.replace(`SIGNALSTACK_${providerId.toUpperCase()}_OAUTH_`, "");
    if (shortKey === "CLIENT_ID") return !env.clientId;
    if (shortKey === "CLIENT_SECRET") return !env.clientSecret;
    if (shortKey === "AUTHORIZE_URL") return !env.authorizeUrl;
    if (shortKey === "TOKEN_URL") return !env.tokenUrl;
    return true;
  });
}

export function getOAuthRedirectUri(request: Request, providerId: ProviderId) {
  const url = new URL(request.url);
  return `${url.origin}/api/subscription-oauth/callback?provider=${providerId}`;
}
