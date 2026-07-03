import {
  pollDeviceFlow,
  refreshTokens,
  startDeviceFlow,
  type PendingDeviceFlow,
} from "@/lib/oauth/device-flow";
import { SUBSCRIPTION_PROVIDERS, decodeJwtPayload } from "@/lib/oauth/providers";
import { clearTokens, loadTokens, saveTokens } from "@/lib/oauth/token-store";
import {
  clearPersistedUsage,
  loadPersistedUsage,
  savePersistedUsage,
} from "@/lib/oauth/usage-store";
import {
  clearCooldown,
  loadCooldownUntil,
  saveCooldownUntil,
} from "@/lib/oauth/cooldown-store";
import type {
  DevicePollResult,
  StoredTokens,
  SubscriptionProviderId,
  SubscriptionUsage,
  TokenRefreshConfig,
} from "@/lib/oauth/types";

export type ConnectionStatus =
  | { kind: "disconnected" }
  | { kind: "connected"; usage: SubscriptionUsage; updatedAt: string }
  | { kind: "error"; message: string };

export interface ConnectionStatusOptions {
  allowNetwork?: boolean;
  /**
   * User-initiated refresh: bypass the provider's min-fetch interval and any
   * cooldown we optimistically clamped ourselves, and hit the network now.
   * A genuine Anthropic 429 will still re-establish the cooldown afterwards.
   */
  force?: boolean;
}

const REFRESH_BUFFER_MS = 60_000;
const SUBSCRIPTION_CACHE_MS = 60_000;
const ERROR_CACHE_MS = 15_000;
// A forced (user-initiated) fetch that lands within this window of ANY prior
// result is served from cache. Guards against double-hits when a single
// pull-to-refresh triggers both the store-level warm and per-card refreshes —
// critical for Anthropic, which extends its 429 penalty on every request.
const FORCE_DEDUPE_MS = 30_000;

/**
 * True when a stored token is already past its expiry and has no refresh token,
 * so it can never produce a successful authenticated request.
 */
function isUnrefreshableExpiredToken(tokens: StoredTokens): boolean {
  return (
    tokens.expiresAt !== null &&
    tokens.expiresAt <= Date.now() &&
    !tokens.refreshToken
  );
}

type ConnectionStatusCacheEntry = {
  status: ConnectionStatus;
  fetchedAt: number;
  expiresAt: number;
};

const connectionStatusCache = new Map<SubscriptionProviderId, ConnectionStatusCacheEntry>();
const inFlightConnectionStatus = new Map<string, Promise<ConnectionStatus>>();

// Persisted last-known-good usage so we can keep showing real numbers when the
// upstream usage endpoint is rate limited or otherwise unreachable.
const lastGoodUsage = new Map<SubscriptionProviderId, { usage: SubscriptionUsage; fetchedAt: number }>();
const cooldownUntilMap = new Map<SubscriptionProviderId, number>();
let persistedUsageHydrated = false;

async function hydratePersistedUsage() {
  if (persistedUsageHydrated) return;
  persistedUsageHydrated = true;
  await Promise.all(
    (Object.keys(SUBSCRIPTION_PROVIDERS) as SubscriptionProviderId[]).map(async (id) => {
      const [stored, cooldown] = await Promise.all([
        loadPersistedUsage(id),
        loadCooldownUntil(id),
      ]);
      if (stored?.usage?.fetchState === "live") {
        lastGoodUsage.set(id, { usage: stored.usage, fetchedAt: stored.fetchedAt });
      }
      if (cooldown && cooldown > Date.now()) {
        cooldownUntilMap.set(id, cooldown);
      }
    }),
  );
}

function deviceFlowFor(providerId: SubscriptionProviderId) {
  const def = SUBSCRIPTION_PROVIDERS[providerId];
  if (!def.deviceFlow) {
    throw new Error(`${def.label} does not use device-flow login.`);
  }
  return def.deviceFlow;
}

export async function beginDeviceLogin(
  providerId: SubscriptionProviderId,
): Promise<PendingDeviceFlow> {
  return startDeviceFlow(deviceFlowFor(providerId));
}

export async function pollDeviceLogin(
  providerId: SubscriptionProviderId,
  pending: PendingDeviceFlow,
): Promise<DevicePollResult> {
  const result = await pollDeviceFlow(deviceFlowFor(providerId), pending);
  if (result.kind === "success") {
    await saveTokens(providerId, result.tokens);
  }
  return result;
}

/**
 * Save an api-token provider's credentials. Accepts either a plain access
 * token string or the full JSON contents of an auth file (e.g.
 * ~/.codex/auth.json). When a refresh token is available, the manager will
 * automatically refresh the access token when it expires.
 */
export async function saveApiToken(
  providerId: SubscriptionProviderId,
  token: string,
  refreshToken?: string | null,
  expiresAt?: number | null,
  idToken?: string | null,
  accountId?: string | null,
  clientId?: string | null,
  clientSecret?: string | null,
): Promise<void> {
  await saveTokens(providerId, {
    accessToken: token.trim(),
    refreshToken: refreshToken?.trim() || null,
    expiresAt: expiresAt ?? null,
    idToken: idToken?.trim() || null,
    accountId: accountId?.trim() || null,
    clientId: clientId?.trim() || null,
    clientSecret: clientSecret?.trim() || null,
  });
  // New tokens mean the old cached status (usually "disconnected") is stale.
  connectionStatusCache.delete(providerId);
  // A freshly pasted token must get an immediate, clean network attempt — drop
  // any persisted rate-limit cooldown left over from the previous (expired)
  // token so we don't keep showing "throttled, retry in N min" against a token
  // that is actually valid now.
  cooldownUntilMap.delete(providerId);
  void clearCooldown(providerId);
}

export interface ParsedTokenInput {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  idToken: string | null;
  accountId: string | null;
  clientId: string | null;
  clientSecret: string | null;
}

/**
 * Parse a raw token input string. Accepts either a plain access token or the
 * full JSON contents of an auth file (e.g. ~/.codex/auth.json or
 * ~/.claude/.credentials.json). Extracts access_token, refresh_token, and
 * expiry (from JSON fields or JWT exp claim).
 */
export function parseTokenInput(raw: string): ParsedTokenInput {
  const trimmed = raw.trim();
  if (!trimmed) return { accessToken: "", refreshToken: null, expiresAt: null, idToken: null, accountId: null, clientId: null, clientSecret: null };

  // Try JSON first (auth file contents)
  const jsonInput = extractJsonObject(trimmed) ?? trimmed;
  try {
    const json = JSON.parse(jsonInput) as Record<string, unknown>;
    // Codex auth.json nests under "tokens"; Claude Code Keychain output has
    // changed shapes over time, so fall back to recursively finding token keys.
    const tokensObj = (json.tokens && typeof json.tokens === "object") ? json.tokens as Record<string, unknown> : json;
    const accessToken =
      (typeof tokensObj.access_token === "string" ? tokensObj.access_token : null) ??
      (typeof tokensObj.accessToken === "string" ? tokensObj.accessToken : null) ??
      findStringByKey(json, ["access_token", "accessToken", "access_token_value", "oauth_access_token"]);
    if (accessToken) {
      const refreshToken =
        (typeof tokensObj.refresh_token === "string" ? tokensObj.refresh_token : null) ??
        (typeof tokensObj.refreshToken === "string" ? tokensObj.refreshToken : null) ??
        findStringByKey(json, ["refresh_token", "refreshToken", "oauth_refresh_token"]) ??
        null;
      const idToken =
        (typeof tokensObj.id_token === "string" ? tokensObj.id_token : null) ??
        (typeof tokensObj.idToken === "string" ? tokensObj.idToken : null) ??
        findStringByKey(json, ["id_token", "idToken"]) ??
        null;
      const accountId =
        (typeof tokensObj.account_id === "string" ? tokensObj.account_id : null) ??
        (typeof tokensObj.accountId === "string" ? tokensObj.accountId : null) ??
        findStringByKey(json, ["account_id", "accountId"]) ??
        null;
      const clientId =
        (typeof tokensObj.client_id === "string" ? tokensObj.client_id : null) ??
        (typeof tokensObj.clientId === "string" ? tokensObj.clientId : null) ??
        (typeof tokensObj.ClientID === "string" ? tokensObj.ClientID : null) ??
        (typeof tokensObj.clientID === "string" ? tokensObj.clientID : null) ??
        findStringByKey(json, ["client_id", "clientId", "ClientID", "clientID"]) ??
        null;
      const clientSecret =
        (typeof tokensObj.client_secret === "string" ? tokensObj.client_secret : null) ??
        (typeof tokensObj.clientSecret === "string" ? tokensObj.clientSecret : null) ??
        (typeof tokensObj.ClientSecret === "string" ? tokensObj.ClientSecret : null) ??
        findStringByKey(json, ["client_secret", "clientSecret", "ClientSecret"]) ??
        null;
      const explicitExpiry =
        (typeof tokensObj.expires_at === "number" ? tokensObj.expires_at : null) ??
        (typeof tokensObj.expiresAt === "number" ? tokensObj.expiresAt : null) ??
        (typeof tokensObj.expiry_date === "number" ? tokensObj.expiry_date : null) ??
        (typeof tokensObj.expiryDate === "number" ? tokensObj.expiryDate : null) ??
        findNumberByKey(json, ["expires_at", "expiresAt", "expiry_date", "expiryDate"]) ??
        null;
      const expiryString =
        findStringByKey(json, ["token_expiry", "tokenExpiry", "expiry", "expiryDate", "expires_at", "expiresAt"]);
      const expiresInSeconds = findNumberByKey(json, ["expires_in", "expiresIn"]);
      const parsedExpiry = expiryString ? Date.parse(expiryString) : NaN;
      const expiresAt =
        explicitExpiry ??
        (Number.isFinite(parsedExpiry) ? parsedExpiry : null) ??
        (expiresInSeconds !== null && expiresInSeconds > 0 ? Date.now() + expiresInSeconds * 1000 : null) ??
        jwtExpMs(accessToken);
      return { accessToken, refreshToken, expiresAt, idToken, accountId, clientId, clientSecret };
    }
  } catch {
    // Not JSON — fall through to plain-token handling
  }

  const extractedToken = extractLikelyAccessToken(trimmed);
  if (extractedToken) {
    return {
      accessToken: extractedToken,
      refreshToken: extractLabeledValue(trimmed, ["refresh_token", "refreshToken"]),
      expiresAt: jwtExpMs(extractedToken),
      idToken: extractLabeledValue(trimmed, ["id_token", "idToken"]),
      accountId: extractLabeledValue(trimmed, ["account_id", "accountId"]),
      clientId: extractLabeledValue(trimmed, ["client_id", "clientId"]),
      clientSecret: extractLabeledValue(trimmed, ["client_secret", "clientSecret"]),
    };
  }

  // Plain token string
  return {
    accessToken: trimmed,
    refreshToken: null,
    expiresAt: jwtExpMs(trimmed),
    idToken: null,
    accountId: null,
    clientId: null,
    clientSecret: null,
  };
}

function extractJsonObject(input: string): string | null {
  // Strip ANSI escape codes so pasted terminal output still parses.
  const cleaned = input.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function findStringByKey(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = record[key];
    if (typeof found === "string" && found.trim()) return found.trim();
  }
  for (const nested of Object.values(record)) {
    const found = findStringByKey(nested, keys);
    if (found) return found;
  }
  return null;
}

function findNumberByKey(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumberByKey(item, keys);
      if (found !== null) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = record[key];
    if (typeof found === "number" && Number.isFinite(found)) return found;
    if (typeof found === "string") {
      const parsed = Number(found);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  for (const nested of Object.values(record)) {
    const found = findNumberByKey(nested, keys);
    if (found !== null) return found;
  }
  return null;
}

function extractLikelyAccessToken(input: string): string | null {
  const labeled = extractLabeledValue(input, ["access_token", "accessToken", "CLAUDE_CODE_OAUTH_TOKEN"]);
  if (labeled) return labeled;
  const match = input.match(/(?:sk-ant-oat[\w.-]+|eyJ[\w.-]+)/);
  return match?.[0] ?? null;
}

function extractLabeledValue(input: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = input.match(new RegExp(`${escaped}["'\\s:=]+["']?([^"'\\s,}]+)`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/** Extract the `exp` claim from a JWT and return it as epoch-ms, or null. */
function jwtExpMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const exp = payload.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) return exp * 1000;
  return null;
}

/**
 * Parse a raw token input and immediately save it. Convenience wrapper around
 * parseTokenInput + saveApiToken.
 */
export async function parseAndSaveApiToken(
  providerId: SubscriptionProviderId,
  raw: string,
): Promise<void> {
  const parsed = parseTokenInput(raw);
  if (!parsed.accessToken) throw new Error("No access token found in input.");
  console.log(
    `[SignalStack] parsed token for ${providerId}: refresh=${Boolean(parsed.refreshToken)} expiry=${parsed.expiresAt ? new Date(parsed.expiresAt).toISOString() : "none"} clientId=${Boolean(parsed.clientId)} clientSecret=${Boolean(parsed.clientSecret)}`,
  );
  if (!parsed.clientId) {
    try {
      const json = JSON.parse(extractJsonObject(raw.trim()) ?? raw.trim()) as Record<string, unknown>;
      console.log(`[SignalStack] token JSON top-level keys for ${providerId}:`, Object.keys(json).join(", "));
    } catch {
      // ignore
    }
  }
  await saveApiToken(
    providerId,
    parsed.accessToken,
    parsed.refreshToken,
    parsed.expiresAt,
    parsed.idToken,
    parsed.accountId,
    parsed.clientId,
    parsed.clientSecret,
  );
}

export async function disconnect(providerId: SubscriptionProviderId): Promise<void> {
  await clearTokens(providerId);
  await clearPersistedUsage(providerId);
  await clearCooldown(providerId);
  lastGoodUsage.delete(providerId);
  cooldownUntilMap.delete(providerId);
  connectionStatusCache.delete(providerId);
}

// ── Token refresh for api-token providers ──────────────────────────────

async function refreshApiToken(
  config: TokenRefreshConfig,
  refreshToken: string,
  tokens?: StoredTokens,
): Promise<StoredTokens> {
  const clientId = config.clientId ?? tokens?.clientId;
  const clientSecret = config.clientSecret ?? tokens?.clientSecret;
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  };
  if (clientId) params.client_id = clientId;
  if (clientSecret) params.client_secret = clientSecret;
  if (config.scopes && config.scopes.length > 0) {
    params.scope = config.scopes.join(" ");
  }

  // Anthropic's OAuth token endpoint expects a JSON body; most other providers
  // (OAuth 2 standard) expect form-encoding. Default to form.
  const useJson = config.bodyFormat === "json";
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": useJson
        ? "application/json"
        : "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: useJson
      ? JSON.stringify(params)
      : new URLSearchParams(params).toString(),
  });

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON body
  }

  if (!response.ok || typeof data.access_token !== "string") {
    const message =
      (data.error as string | undefined) ??
      (data.error_description as string | undefined) ??
      (data.message as string | undefined) ??
      `Token refresh failed (HTTP ${response.status}).`;
    console.warn(`[SignalStack] token refresh error for ${config.tokenUrl}: ${message}`, JSON.stringify(data));
    throw new Error(message);
  }

  let expiresAt: number | null = null;
  if (typeof data.expires_in === "number") {
    expiresAt = Date.now() + data.expires_in * 1000;
  }

  return {
    accessToken: data.access_token,
    refreshToken: (data.refresh_token as string | undefined) ?? refreshToken,
    expiresAt,
    idToken: (data.id_token as string | undefined) ?? null,
    accountId: (data.account_id as string | undefined) ?? null,
    resourceUrl: (data.resource_url as string | undefined) ?? null,
    scope: (data.scope as string | undefined) ?? null,
  };
}

/**
 * Unconditionally refresh a provider's tokens (used when the usage endpoint
 * returns 401 even though the access token wasn't clock-expired). Mirrors the
 * upstream CLI's refreshOAuth-on-401 behavior. Returns the new tokens, or null
 * when there is no refresh token / the refresh fails.
 */
// Records the error message from the most recent forceRefreshTokens() call per
// provider, so callers (e.g. the Claude usage fetch) can surface *why* a
// refresh produced no new token instead of a generic message.
const lastRefreshErrorMap = new Map<SubscriptionProviderId, string | null>();

async function forceRefreshTokens(
  providerId: SubscriptionProviderId,
  tokens: StoredTokens,
): Promise<StoredTokens | null> {
  const def = SUBSCRIPTION_PROVIDERS[providerId];
  if (!tokens.refreshToken) return null;
  try {
    if (def.deviceFlow) {
      const refreshed = await refreshTokens(def.deviceFlow, tokens.refreshToken);
      await saveTokens(providerId, refreshed);
      lastRefreshErrorMap.delete(providerId);
      return refreshed;
    }
    if (def.tokenRefresh) {
      const refreshed = await refreshApiToken(def.tokenRefresh, tokens.refreshToken, tokens);
      const merged = {
        ...tokens,
        ...refreshed,
        accountId: refreshed.accountId ?? tokens.accountId ?? null,
        resourceUrl: refreshed.resourceUrl ?? tokens.resourceUrl ?? null,
        scope: refreshed.scope ?? tokens.scope ?? null,
        clientId: refreshed.clientId ?? tokens.clientId ?? null,
        clientSecret: refreshed.clientSecret ?? tokens.clientSecret ?? null,
      };
      await saveTokens(providerId, merged);
      lastRefreshErrorMap.delete(providerId);
      return merged;
    }
  } catch (error) {
    lastRefreshErrorMap.set(
      providerId,
      error instanceof Error ? error.message : String(error),
    );
    console.warn(`[SignalStack] forced token refresh failed for ${providerId}`, error);
    return null;
  }
  return null;
}

async function ensureFreshTokens(
  providerId: SubscriptionProviderId,
  tokens: StoredTokens,
): Promise<StoredTokens> {
  const def = SUBSCRIPTION_PROVIDERS[providerId];
  const needsRefresh =
    tokens.expiresAt !== null && tokens.expiresAt - REFRESH_BUFFER_MS <= Date.now();
  if (!needsRefresh || !tokens.refreshToken) {
    return tokens;
  }

  // Device-flow providers use the existing refreshTokens helper.
  if (def.deviceFlow) {
    const refreshed = await refreshTokens(def.deviceFlow, tokens.refreshToken);
    await saveTokens(providerId, refreshed);
    return refreshed;
  }

  // Api-token providers with a tokenRefresh config.
  if (def.tokenRefresh) {
    try {
      const refreshed = await refreshApiToken(def.tokenRefresh, tokens.refreshToken, tokens);
      const merged = {
        ...tokens,
        ...refreshed,
        accountId: refreshed.accountId ?? tokens.accountId ?? null,
        resourceUrl: refreshed.resourceUrl ?? tokens.resourceUrl ?? null,
        scope: refreshed.scope ?? tokens.scope ?? null,
        clientId: refreshed.clientId ?? tokens.clientId ?? null,
        clientSecret: refreshed.clientSecret ?? tokens.clientSecret ?? null,
      }
      await saveTokens(providerId, merged);
      return merged;
    } catch (error) {
      // If refresh fails, fall through with the existing (possibly stale)
      // token — the usage fetch will surface a clear error.
      console.warn(`[SignalStack] token refresh failed for ${providerId}`, error);
      return tokens;
    }
  }

  return tokens;
}

export async function getConnectionStatus(
  providerId: SubscriptionProviderId,
  options: ConnectionStatusOptions = {},
): Promise<ConnectionStatus> {
  const allowNetwork = options.allowNetwork ?? true;
  const force = options.force ?? false;
  const cached = connectionStatusCache.get(providerId);
  if (!force && cached && cached.expiresAt > Date.now() && shouldUseCachedStatus(cached.status, allowNetwork)) {
    return cached.status;
  }
  if (force && cached && Date.now() - cached.fetchedAt < FORCE_DEDUPE_MS) {
    return cached.status;
  }

  const key = inFlightKey(providerId, allowNetwork, force);
  const existing = inFlightConnectionStatus.get(key);
  if (existing) return existing;

  const request = loadConnectionStatus(providerId, allowNetwork, force);
  inFlightConnectionStatus.set(key, request);
  try {
    return await request;
  } finally {
    inFlightConnectionStatus.delete(key);
  }
}

function inFlightKey(providerId: SubscriptionProviderId, allowNetwork: boolean, force = false) {
  return `${providerId}:${allowNetwork ? "network" : "cache"}${force ? ":force" : ""}`;
}

function shouldUseCachedStatus(status: ConnectionStatus, allowNetwork: boolean) {
  if (!allowNetwork) return true;
  return status.kind === "connected" && Boolean(status.usage.cooldownUntil && status.usage.cooldownUntil > Date.now());
}

async function loadConnectionStatus(
  providerId: SubscriptionProviderId,
  allowNetwork: boolean,
  force = false,
): Promise<ConnectionStatus> {
  const stored = await loadTokens(providerId);
  if (!stored) {
    return cacheConnectionStatus(providerId, { kind: "disconnected" });
  }

  await hydratePersistedUsage();

  // A stored access token that is already expired AND cannot be refreshed will
  // never succeed. This matters most for Claude: its OAuth `/usage` endpoint is
  // edge-throttled and returns a Cloudflare 429 *before* auth is checked, so an
  // expired token surfaces as a misleading "rate limited" instead of a 401 we
  // could act on. Detect the dead token locally and ask the user to reconnect
  // instead of hammering an endpoint that will only ever 429.
  if (isUnrefreshableExpiredToken(stored)) {
    return cacheConnectionStatus(providerId, {
      kind: "error",
      message: `${SUBSCRIPTION_PROVIDERS[providerId].shortLabel} token expired — reconnect to refresh usage.`,
    });
  }

  // Honor a persisted cooldown — do NOT touch the network until it expires.
  // Anthropic extends the penalty on every retry, so silent auto-refreshes
  // from screen focus / pull-to-refresh must short-circuit here.
  const cooldownUntil = cooldownUntilMap.get(providerId);
  if (!force && cooldownUntil && cooldownUntil > Date.now()) {
    return cacheConnectionStatus(
      providerId,
      buildCooldownStatus(providerId, cooldownUntil),
    );
  }

  if (!allowNetwork) {
    return cacheConnectionStatus(providerId, buildCachedConnectedStatus(providerId));
  }

  // Honor the provider-defined minimum fetch interval. If we have a
  // last-known-good usage that is still within the interval, return
  // it without touching the network. This is critical for Anthropic,
  // which throttles globally and extends its own cooldown on every
  // request — re-fetching on every screen focus would never let the
  // penalty drain.
  const minInterval = SUBSCRIPTION_PROVIDERS[providerId].minFetchIntervalMs;
  const prior = lastGoodUsage.get(providerId);
  if (!force && minInterval && prior && Date.now() - prior.fetchedAt < minInterval) {
    const nextEligibleAt = prior.fetchedAt + minInterval;
    return cacheConnectionStatus(providerId, {
      kind: "connected",
      usage: {
        ...prior.usage,
        fetchState: "live",
        cooldownUntil: nextEligibleAt,
      },
      updatedAt: new Date(prior.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    });
  }

  try {
    const tokens = await ensureFreshTokens(providerId, stored);
    const usage = await SUBSCRIPTION_PROVIDERS[providerId].fetchUsage(tokens, {
      // Let the provider refresh + retry on a 401, mirroring the upstream CLI.
      refreshTokens: () => forceRefreshTokens(providerId, tokens),
      lastRefreshError: () => lastRefreshErrorMap.get(providerId) ?? null,
    });
    if (usage.fetchState === "live") {
      lastGoodUsage.set(providerId, { usage, fetchedAt: Date.now() });
      cooldownUntilMap.delete(providerId);
      void savePersistedUsage(providerId, usage);
      void clearCooldown(providerId);
    } else if (usage.fetchState === "rate_limited" && usage.cooldownUntil) {
      // Anthropic's `/usage` endpoint is edge-throttled (Cloudflare 429s
      // before auth) and returns a real, counting-down retry-after. Respect
      // it, but never poll more often than the provider's min fetch interval
      // so background refreshes can't reignite the penalty.
      const clamped = minInterval
        ? Math.max(usage.cooldownUntil, Date.now() + minInterval)
        : usage.cooldownUntil;
      cooldownUntilMap.set(providerId, clamped);
      usage.cooldownUntil = clamped;
      void saveCooldownUntil(providerId, clamped);
    }
    const mergedUsage = mergeRateLimitedUsage(providerId, usage);
    return cacheConnectionStatus(providerId, {
      kind: "connected",
      usage: mergedUsage,
      updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    });
  } catch (error) {
    const prior = lastGoodUsage.get(providerId);
    if (prior) {
      const staleHint = `Last refresh failed · showing ${formatRelative(prior.fetchedAt)} data`;
      const decorated: SubscriptionUsage = {
        ...prior.usage,
        fetchState: "rate_limited",
        cooldownUntil: Date.now() + ERROR_CACHE_MS,
        summary: prior.usage.summary
          ? { ...prior.usage.summary, resetHint: staleHint }
          : prior.usage.summary,
        limits: prior.usage.limits.map((row) => ({
          ...row,
          resetHint: row.resetHint ? `${row.resetHint} · stale` : "stale",
        })),
      };
      return cacheConnectionStatus(providerId, {
        kind: "connected",
        usage: decorated,
        updatedAt: new Date(prior.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
    }
    return cacheConnectionStatus(providerId, {
      kind: "error",
      message: error instanceof Error ? error.message : "Unknown error fetching usage.",
    });
  }
}

function buildCachedConnectedStatus(providerId: SubscriptionProviderId): ConnectionStatus {
  const prior = lastGoodUsage.get(providerId);
  if (prior) {
    return {
      kind: "connected",
      usage: prior.usage,
      updatedAt: new Date(prior.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
  }

  const def = SUBSCRIPTION_PROVIDERS[providerId];
  return {
    kind: "connected",
    updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    usage: {
      summary: null,
      limits: [],
      planLabel: `${def.shortLabel} subscription connected`,
      fetchState: "rate_limited",
      cooldownUntil: null,
    },
  };
}

export async function isConnected(providerId: SubscriptionProviderId): Promise<boolean> {
  return (await loadTokens(providerId)) !== null;
}

function cacheConnectionStatus(
  providerId: SubscriptionProviderId,
  status: ConnectionStatus,
): ConnectionStatus {
  const fetchedAt = Date.now();
  connectionStatusCache.set(providerId, {
    status,
    fetchedAt,
    expiresAt: expiryForStatus(status, fetchedAt),
  });
  return status;
}

function expiryForStatus(status: ConnectionStatus, fetchedAt: number) {
  if (status.kind === "connected" && status.usage.cooldownUntil && status.usage.cooldownUntil > fetchedAt) {
    return status.usage.cooldownUntil;
  }
  if (status.kind === "error") return fetchedAt + ERROR_CACHE_MS;
  return fetchedAt + SUBSCRIPTION_CACHE_MS;
}

function mergeRateLimitedUsage(
  providerId: SubscriptionProviderId,
  next: SubscriptionUsage,
): SubscriptionUsage {
  if (next.fetchState !== "rate_limited") return next;
  const prior = lastGoodUsage.get(providerId);
  if (!prior) return next;

  const retrySuffix = next.summary?.resetHint ?? "Retry later";
  return {
    ...prior.usage,
    fetchState: "rate_limited",
    cooldownUntil: next.cooldownUntil ?? null,
    summary: prior.usage.summary
      ? { ...prior.usage.summary, resetHint: retrySuffix }
      : next.summary,
    limits: prior.usage.limits.map((row) => ({
      ...row,
      resetHint: row.resetHint ? `${row.resetHint} · ${retrySuffix}` : retrySuffix,
    })),
    planLabel: prior.usage.planLabel ?? next.planLabel,
  };
}

function buildCooldownStatus(
  providerId: SubscriptionProviderId,
  cooldownUntil: number,
): ConnectionStatus {
  const prior = lastGoodUsage.get(providerId);
  const retryIn = formatUntil(cooldownUntil);
  const retrySuffix = `Retry in ${retryIn}`;
  if (!prior) {
    // We've never had a successful fetch. Anthropic's usage endpoint is known
    // to throttle aggressively (retry-after: 0, no real reset signal) and the
    // budget is shared with the Claude Code CLI on your computer. Make clear
    // that the time below is our own backoff, not Anthropic's actual reset.
    const knownIssueHint =
      "Known Anthropic-side throttling (shared with Claude Code on your computer)";
    return {
      kind: "connected",
      updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      usage: {
        summary: {
          label: "Waiting on Anthropic usage endpoint",
          used: null,
          limit: null,
          percentUsed: null,
          resetHint: `${knownIssueHint} · next attempt in ${retryIn}`,
        },
        limits: [
          {
            label: "5-hour window",
            used: null,
            limit: null,
            percentUsed: null,
            resetHint: `${knownIssueHint} · next attempt in ${retryIn}`,
          },
          {
            label: "Weekly window",
            used: null,
            limit: null,
            percentUsed: null,
            resetHint: `Next attempt in ${retryIn}`,
          },
        ],
        planLabel: "Claude Pro / Max",
        fetchState: "rate_limited",
        cooldownUntil,
      },
    };
  }
  return {
    kind: "connected",
    updatedAt: new Date(prior.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    usage: {
      ...prior.usage,
      fetchState: "rate_limited",
      cooldownUntil,
      summary: prior.usage.summary
        ? { ...prior.usage.summary, resetHint: retrySuffix }
        : prior.usage.summary,
      limits: prior.usage.limits.map((row) => ({
        ...row,
        resetHint: row.resetHint ? `${row.resetHint} · ${retrySuffix}` : retrySuffix,
      })),
    },
  };
}

function formatUntil(epochMs: number): string {
  const diff = Math.max(0, epochMs - Date.now());
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(seconds / 360) / 10;
  return `${hrs} hr`;
}

function formatRelative(epochMs: number): string {
  const diff = Math.max(0, Date.now() - epochMs);
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s old`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min old`;
  const hrs = Math.round(seconds / 360) / 10;
  return `${hrs} hr old`;
}
