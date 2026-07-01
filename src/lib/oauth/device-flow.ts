import * as Crypto from "expo-crypto";

import type {
  DeviceAuthorization,
  DevicePollResult,
  StoredTokens,
} from "@/lib/oauth/types";

export type DeviceFlowDialect = "standard" | "minimax";

export interface DeviceFlowConfig {
  clientId: string;
  deviceAuthorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
  /** Whether to generate and send a PKCE code_challenge (MiniMax). */
  usePkce?: boolean;
  /**
   * Provider-specific quirks. "minimax" omits device_code (the session is keyed
   * by user_code), reports interval in ms, echoes a `state`, and signals pending
   * via a `status` field instead of an OAuth error code.
   */
  dialect?: DeviceFlowDialect;
}

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const REQUEST_TIMEOUT_MS = 15_000;
const NETWORK_RETRY_DELAYS_MS = [500, 1_500];

/** PKCE verifier + state kept in-memory between start + poll for a single flow. */
export interface PendingDeviceFlow {
  authorization: DeviceAuthorization;
  codeVerifier: string | null;
  state: string | null;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
  const digestHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  const digestBytes = new Uint8Array(digestHex.length / 2);
  for (let i = 0; i < digestBytes.length; i += 1) {
    digestBytes[i] = parseInt(digestHex.slice(i * 2, i * 2 + 2), 16);
  }
  return base64UrlEncode(digestBytes);
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(Crypto.getRandomBytes(32));
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

async function postForm(url: string, params: Record<string, string>) {
  const body = new URLSearchParams(params).toString();
  const response = await fetchWithNetworkRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "Cache-Control": "no-store",
    },
    body,
  });
  let data: Record<string, unknown> = {};
  let text = "";
  try {
    text = await response.text();
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // Non-JSON body; expose the raw text for error messages.
    data = text ? { _raw: text } : {};
  }
  return { status: response.status, data };
}

async function fetchWithNetworkRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= NETWORK_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt === NETWORK_RETRY_DELAYS_MS.length) {
        break;
      }
      await sleep(NETWORK_RETRY_DELAYS_MS[attempt]);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(networkErrorMessage(url, lastError));
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    message.includes("timed out") ||
    message.includes("lost")
  );
}

function networkErrorMessage(url: string, error: unknown) {
  const host = safeHost(url);
  const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
  return `Could not reach ${host}. Check Wi-Fi/cellular and try again${detail}.`;
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "the auth server";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** MiniMax wraps errors in base_resp.status_code != 0. */
function baseRespError(data: Record<string, unknown>): string | null {
  const baseResp = data.base_resp;
  if (baseResp && typeof baseResp === "object") {
    const code = (baseResp as Record<string, unknown>).status_code;
    const msg = (baseResp as Record<string, unknown>).status_msg;
    if (typeof code === "number" && code !== 0) {
      return typeof msg === "string" && msg.length > 0 ? msg : `error ${code}`;
    }
  }
  return null;
}

export async function startDeviceFlow(config: DeviceFlowConfig): Promise<PendingDeviceFlow> {
  const params: Record<string, string> = { client_id: config.clientId };
  if (config.scopes && config.scopes.length > 0) {
    params.scope = config.scopes.join(" ");
  }

  let state: string | null = null;
  if (config.dialect === "minimax") {
    state = base64UrlEncode(Crypto.getRandomBytes(16));
    params.state = state;
  }

  let codeVerifier: string | null = null;
  if (config.usePkce) {
    const pkce = await createPkcePair();
    codeVerifier = pkce.verifier;
    params.code_challenge = pkce.challenge;
    params.code_challenge_method = "S256";
  }

  const { status, data } = await postForm(config.deviceAuthorizationUrl, params);

  const baseErr = baseRespError(data);
  if (status >= 400 || baseErr) {
    throw new Error(
      baseErr ??
        readString(data, "error_description") ??
        readString(data, "error") ??
        readString(data, "_raw") ??
        `Device authorization failed (HTTP ${status}).`,
    );
  }

  const userCode = readString(data, "user_code");
  // Standard flow keys polling by device_code; MiniMax keys by user_code.
  const deviceCode = readString(data, "device_code");
  if (!userCode) {
    throw new Error("Device authorization response was missing user_code.");
  }
  if (config.dialect !== "minimax" && !deviceCode) {
    throw new Error("Device authorization response was missing device_code.");
  }

  if (config.dialect === "minimax" && state) {
    const returnedState = readString(data, "state");
    if (returnedState && returnedState !== state) {
      throw new Error("OAuth state mismatch — please try connecting again.");
    }
  }

  // MiniMax reports interval in milliseconds; normalize to seconds.
  const rawInterval = typeof data.interval === "number" && data.interval > 0 ? data.interval : null;
  const interval =
    rawInterval === null
      ? 5
      : config.dialect === "minimax"
        ? Math.max(1, Math.round(rawInterval / 1000))
        : rawInterval;

  const authorization: DeviceAuthorization = {
    deviceCode: deviceCode ?? "",
    userCode,
    verificationUri: readString(data, "verification_uri") ?? "",
    verificationUriComplete: readString(data, "verification_uri_complete"),
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : null,
    interval,
  };

  return { authorization, codeVerifier, state };
}

function tokensFromResponse(data: Record<string, unknown>): StoredTokens {
  const accessToken = readString(data, "access_token");
  if (!accessToken) {
    throw new Error("Token response missing access_token.");
  }

  let expiresAt: number | null = null;
  if (typeof data.expires_in === "number") {
    expiresAt = Date.now() + data.expires_in * 1000;
  } else if (typeof data.expired_in === "number") {
    // MiniMax returns an absolute epoch-ms expiry under expired_in.
    expiresAt = data.expired_in;
  }

  return {
    accessToken,
    refreshToken: readString(data, "refresh_token"),
    expiresAt,
    resourceUrl: readString(data, "resource_url"),
    scope: readString(data, "scope"),
  };
}

export async function pollDeviceFlow(
  config: DeviceFlowConfig,
  pending: PendingDeviceFlow,
): Promise<DevicePollResult> {
  const params: Record<string, string> = {
    client_id: config.clientId,
    grant_type: DEVICE_CODE_GRANT,
  };

  if (config.dialect === "minimax") {
    // MiniMax keys the poll by user_code + code_verifier (no device_code).
    params.user_code = pending.authorization.userCode;
    if (pending.codeVerifier) params.code_verifier = pending.codeVerifier;
  } else {
    params.device_code = pending.authorization.deviceCode;
    if (pending.codeVerifier) params.code_verifier = pending.codeVerifier;
  }

  const { status, data } = await postForm(config.tokenUrl, params);

  if (status === 200 && typeof data.access_token === "string") {
    return { kind: "success", tokens: tokensFromResponse(data) };
  }
  if (status === 200 && readString(data, "status") === "pending") {
    return { kind: "pending" };
  }
  if (status >= 500) {
    return { kind: "pending" };
  }

  const errorCode = readString(data, "error") ?? readString(data, "status") ?? "unknown_error";
  switch (errorCode) {
    case "authorization_pending":
    case "pending":
      return { kind: "pending" };
    case "slow_down":
      return { kind: "slow-down" };
    case "expired_token":
      return { kind: "expired" };
    case "access_denied":
      return { kind: "denied", message: readString(data, "error_description") ?? undefined };
    default:
      throw new Error(
        baseRespError(data) ??
          readString(data, "error_description") ??
          `Device token polling failed: ${errorCode}.`,
      );
  }
}

export async function refreshTokens(
  config: DeviceFlowConfig,
  refreshToken: string,
): Promise<StoredTokens> {
  const { status, data } = await postForm(config.tokenUrl, {
    client_id: config.clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (status >= 400 || typeof data.access_token !== "string") {
    throw new Error(
      baseRespError(data) ??
        readString(data, "error_description") ??
        readString(data, "error") ??
        `Token refresh failed (HTTP ${status}).`,
    );
  }

  const tokens = tokensFromResponse(data);
  if (!tokens.refreshToken) tokens.refreshToken = refreshToken;
  return tokens;
}
