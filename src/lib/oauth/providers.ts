import type { DeviceFlowConfig } from "@/lib/oauth/device-flow";
import type {
  PkceCodeFlowConfig,
  TokenRefreshConfig,
  StoredTokens,
  SubscriptionAuthKind,
  SubscriptionProviderId,
  SubscriptionUsage,
  UsageLimitRow,
} from "@/lib/oauth/types";

/**
 * Optional capabilities the manager hands to a provider's fetchUsage so it can
 * react to auth failures the way the upstream CLI does (e.g. refresh the OAuth
 * token on a 401 and retry once).
 */
export interface UsageFetchContext {
  /** Force-refresh the provider's tokens and return the new set, or null. */
  refreshTokens?: () => Promise<StoredTokens | null>;
  /**
   * Returns the error message from the most recent refreshTokens() call, if it
   * failed. refreshTokens() swallows errors and returns null, so this lets a
   * provider surface *why* the refresh produced no new token (e.g.
   * invalid_client, HTTP 404) instead of a generic "no new token".
   */
  lastRefreshError?: () => string | null;
}

export interface SubscriptionProviderDef {
  id: SubscriptionProviderId;
  label: string;
  shortLabel: string;
  accent: string;
  authKind: SubscriptionAuthKind;
  /** Present for device-flow providers. */
  deviceFlow?: DeviceFlowConfig;
  /** Present for pkce-code providers (browser sign-in, paste code back). */
  pkceCodeFlow?: PkceCodeFlowConfig;
  /** For api-token providers: where the user gets their token. */
  tokenHint?: string;
  /** Friendly setup steps for desktop-first token sources. */
  setupSteps?: string[];
  /** A terminal command users can run on their computer to reveal the JSON/token. */
  helperCommand?: string;
  /** Optional config for refreshing expired api-token access tokens. */
  tokenRefresh?: TokenRefreshConfig;
  /** Fetch + normalize usage from a stored token. */
  fetchUsage: (tokens: StoredTokens, ctx?: UsageFetchContext) => Promise<SubscriptionUsage>;
  /**
   * Minimum wall-clock interval (ms) between live usage fetches. The
   * manager returns the last-known-good cached usage without hitting
   * the network until this interval elapses. Used to avoid hammering
   * endpoints (notably Anthropic) that throttle aggressively and
   * extend their own cooldown on every request.
   */
  minFetchIntervalMs?: number;
}

// ── Kimi / Moonshot ────────────────────────────────────────────────────
const KIMI_OAUTH_HOST = "https://auth.kimi.com";
const KIMI_USAGE_URL = "https://api.kimi.com/coding/v1/usages";

const kimiDeviceFlow: DeviceFlowConfig = {
  clientId: "17e5f671-d194-4dfb-9706-5516cb48c098",
  deviceAuthorizationUrl: `${KIMI_OAUTH_HOST}/api/oauth/device_authorization`,
  tokenUrl: `${KIMI_OAUTH_HOST}/api/oauth/token`,
};

async function fetchKimiUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const json = await getJson(KIMI_USAGE_URL, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const rec = asRecord(json);
  const summary = kimiRow(rec.usage, "Weekly limit");
  const limits: UsageLimitRow[] = summary ? [summary] : [];
  if (Array.isArray(rec.limits)) {
    rec.limits.forEach((item, idx) => {
      const itemRec = asRecord(item);
      const detail = isRecord(itemRec.detail) ? itemRec.detail : itemRec;
      const label =
        readString(itemRec, "name") ??
        readString(detail, "name") ??
        kimiWindowLabel(itemRec.window, idx);
      const row = kimiRow(detail, label);
      if (row) limits.push(row);
    });
  }
  return { summary, limits, planLabel: "Kimi Code subscription" };
}

function kimiRow(raw: unknown, defaultLabel: string): UsageLimitRow | null {
  if (!isRecord(raw)) return null;
  const limit = toInt(raw.limit);
  let used = toInt(raw.used);
  if (used === null) {
    const remaining = toInt(raw.remaining);
    if (remaining !== null && limit !== null) used = limit - remaining;
  }
  if (used === null && limit === null) return null;
  const label = readString(raw, "name") ?? readString(raw, "title") ?? defaultLabel;
  return {
    label,
    used,
    limit,
    percentUsed: percent(used, limit),
    resetHint: resetHint(raw),
  };
}

function kimiWindowLabel(raw: unknown, idx: number): string {
  const window = asRecord(raw);
  const duration = toInt(window.duration);
  const unit = readString(window, "timeUnit") ?? readString(window, "time_unit");
  if (duration !== null && unit === "TIME_UNIT_MINUTE") {
    if (duration % 60 === 0) return `${duration / 60}-hour rolling limit`;
    return `${duration}-minute rolling limit`;
  }
  if (duration !== null && unit === "TIME_UNIT_HOUR") {
    return `${duration}-hour rolling limit`;
  }
  if (duration !== null && unit === "TIME_UNIT_DAY") {
    return `${duration}-day rolling limit`;
  }
  return `Rolling limit #${idx + 1}`;
}

// ── MiniMax ────────────────────────────────────────────────────────────
const MINIMAX_OAUTH_HOST = "https://account.minimax.io";
const MINIMAX_API_HOST = "https://api.minimax.io";

const minimaxDeviceFlow: DeviceFlowConfig = {
  clientId: "659cf4c1-615c-45f6-a5f6-4bf15eb476e5",
  deviceAuthorizationUrl: `${MINIMAX_OAUTH_HOST}/oauth2/device/code`,
  tokenUrl: `${MINIMAX_OAUTH_HOST}/oauth2/token`,
  scopes: ["openid", "profile", "coding_plan"],
  usePkce: true,
  dialect: "minimax",
};

async function fetchMinimaxUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const apiBase = tokens.resourceUrl?.startsWith("http") ? tokens.resourceUrl : MINIMAX_API_HOST;
  const json = await getJson(`${apiBase.replace(/\/+$/, "")}/v1/token_plan/remains`, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const rec = asRecord(json);
  const models = Array.isArray(rec.model_remains) ? rec.model_remains : [];
  const limits: UsageLimitRow[] = [];
  let planLabel: string | null = null;

  for (const entry of models) {
    const m = asRecord(entry);
    const name = readString(m, "model_name") ?? "Plan";
    planLabel = planLabel ?? name;

    const intervalTotal = toInt(m.current_interval_total_count);
    const intervalUsed = toInt(m.current_interval_usage_count);
    if (intervalTotal !== null || intervalUsed !== null) {
      limits.push({
        label: `${name} · 5h`,
        used: intervalUsed,
        limit: intervalTotal,
        percentUsed: percent(intervalUsed, intervalTotal),
        resetHint: secondsHint(m.remains_time),
      });
    }

    const weeklyTotal = toInt(m.current_weekly_total_count);
    const weeklyUsed = toInt(m.current_weekly_usage_count);
    if (weeklyTotal !== null || weeklyUsed !== null) {
      limits.push({
        label: `${name} · Weekly`,
        used: weeklyUsed,
        limit: weeklyTotal,
        percentUsed: percent(weeklyUsed, weeklyTotal),
        resetHint: secondsHint(m.weekly_remains_time),
      });
    }
  }

  return { summary: limits[0] ?? null, limits, planLabel };
}

// ── Z.ai / GLM (API token) ─────────────────────────────────────────────
const ZAI_BASE = "https://api.z.ai";

async function fetchZaiUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  // Z.ai authorizes with the raw token (no "Bearer " prefix).
  const json = await getJson(`${ZAI_BASE}/api/monitor/usage/quota/limit`, {
    Authorization: tokens.accessToken,
  });
  const rec = asRecord(json);
  const data = isRecord(rec.data) ? rec.data : rec;
  const rawLimits = Array.isArray(data.limits) ? data.limits : [];
  const limits: UsageLimitRow[] = [];

  for (const item of rawLimits) {
    const it = asRecord(item);
    const type = readString(it, "type") ?? "";
    const label =
      type === "TOKENS_LIMIT"
        ? "Token usage (5h)"
        : type === "TIME_LIMIT"
          ? "MCP usage (monthly)"
          : type || "Limit";
    const pct = toInt(it.percentage);
    limits.push({
      label,
      used: null,
      limit: null,
      percentUsed: pct,
      resetHint: null,
    });
  }

  return { summary: limits[0] ?? null, limits, planLabel: "GLM Coding Plan" };
}

// ── Claude / Anthropic (OAuth access token) ────────────────────────────
const CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
// Anthropic's usage endpoint puts requests without a claude-code User-Agent
// into a punitive rate-limit bucket. Identify as the real CLI to get the
// generous limit. Bump this to track current Claude Code releases.
const CLAUDE_CODE_USER_AGENT = "claude-code/2.0.31";

async function fetchClaudeUsage(
  tokens: StoredTokens,
  ctx?: UsageFetchContext,
): Promise<SubscriptionUsage> {
  // The OAuth usage endpoint requires BOTH the `anthropic-beta: oauth-2025-04-20`
  // header AND a `User-Agent: claude-code/<version>`. The User-Agent is the
  // critical one: requests without the claude-code UA land in an aggressively
  // rate-limited bucket and get persistent 429s (which is exactly what we saw).
  // With a real claude-code UA the limit is far more generous. The OAuth token
  // must carry the user:inference + user:profile scopes (the Claude Code
  // credential does). We still refresh OAuth on a 401 and retry once, like the CLI.
  const callOnce = (accessToken: string) =>
    getJson(CLAUDE_USAGE_URL, {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": CLAUDE_CODE_USER_AGENT,
    });

  // Records what happened when we tried to auto-refresh, so the surfaced
  // status can tell "genuinely throttled" apart from "refresh is broken".
  type RefreshOutcome = "not_attempted" | "refreshed_retried" | "unchanged" | "error";
  let refreshOutcome = "not_attempted" as RefreshOutcome;
  let refreshErrorMessage: string | null = null;

  const json = await callOnce(tokens.accessToken).catch(async (error) => {
    // Anthropic's `/usage` endpoint sits behind an edge throttle that returns a
    // 429 *before* auth is validated. That means an expired/invalid access
    // token (or one whose scope no longer matches) surfaces as a 429, NOT a
    // 401 — so we can't rely on 401 alone to know when to refresh. On BOTH a
    // 401 and a 429 we try a one-time token refresh, and only retry the request
    // when the refresh actually produced a *different* access token. A repeat
    // 429 after a successful refresh is treated as a genuine rate limit.
    const shouldTryRefresh =
      error instanceof HttpError &&
      (error.status === 401 || error.status === 429) &&
      Boolean(ctx?.refreshTokens);
    if (shouldTryRefresh) {
      try {
        const refreshed = await ctx!.refreshTokens!();
        if (refreshed?.accessToken && refreshed.accessToken !== tokens.accessToken) {
          refreshOutcome = "refreshed_retried";
          console.log(
            `[SignalStack] Claude ${(error as HttpError).status} -> token refreshed, retrying usage fetch`,
          );
          return await callOnce(refreshed.accessToken);
        }
        refreshOutcome = "unchanged";
        // refreshTokens() swallows its own error and returns the same (or no)
        // token. Pull the real reason so the on-device debug line can say
        // whether the refresh was *rejected* (bad endpoint/client_id/grant)
        // vs. the refresh token genuinely being dead.
        refreshErrorMessage = ctx?.lastRefreshError?.() ?? null;
        console.warn(
          `[SignalStack] Claude ${(error as HttpError).status} -> refresh returned no new token`,
          refreshErrorMessage ?? "(no refresh error captured)",
        );
      } catch (refreshError) {
        refreshOutcome = "error";
        refreshErrorMessage =
          refreshError instanceof Error ? refreshError.message : String(refreshError);
        console.warn(`[SignalStack] Claude token refresh on ${(error as HttpError).status} failed`, refreshError);
      }
    }
    if (error instanceof HttpError && error.status !== 429) {
      console.warn(`[SignalStack] Claude usage fetch failed: ${error.status} ${error.message}`);
    }
    if (error instanceof HttpError && error.status === 429) {
      console.warn(
        `[SignalStack] Claude usage 429 (retry-after: ${error.retryAfter ?? "none"}): ${error.message}`,
      );
      return {
        __signalStackRateLimited: true,
        retryAfter: error.retryAfter,
        status: error.status,
        serverMessage: error.message,
      };
    }
    throw error;
  });
  const rec = asRecord(json);
  if (rec.__signalStackRateLimited) {
    const retryAfter = readString(rec, "retryAfter");
    // Anthropic frequently returns retry-after: 0 (or nothing) here, which is
    // meaningless. Only surface a duration when it's actually positive; the
    // manager clamps the real backoff to the provider's min fetch interval.
    const human = humanizeRetry(retryAfter);
    const cooldownUntil = retryAfterToEpochMs(retryAfter);
    const knownIssueHint =
      "Known Anthropic-side throttling (shared with Claude Code on your computer)";
    const status = toInt(rec.status) ?? 429;
    const serverMessage = readString(rec, "serverMessage");
    const refreshNote =
      refreshOutcome === "error"
        ? ` · refresh failed: ${refreshErrorMessage ?? "unknown"}`
        : refreshOutcome === "unchanged"
          ? refreshErrorMessage
            ? ` · refresh rejected: ${refreshErrorMessage}`
            : " · refresh returned no new token (reconnect may be needed)"
          : refreshOutcome === "refreshed_retried"
            ? " · refreshed but still 429 (genuinely throttled)"
            : "";
    const debugDetail = `HTTP ${status} · retry-after: ${retryAfter ?? "none"}${serverMessage ? ` · ${serverMessage}` : ""}${refreshNote}`;
    return {
      summary: {
        label: "Anthropic usage endpoint rate limited",
        used: null,
        limit: null,
        percentUsed: null,
        resetHint: human ? `${knownIssueHint} · retry in ${human}` : knownIssueHint,
      },
      limits: [
        {
          label: "5-hour window",
          used: null,
          limit: null,
          percentUsed: null,
          resetHint: human ? `${knownIssueHint} · retry in ${human}` : knownIssueHint,
        },
        {
          label: "Weekly window",
          used: null,
          limit: null,
          percentUsed: null,
          resetHint: knownIssueHint,
        },
      ],
      planLabel: "Claude Pro / Max",
      fetchState: "rate_limited",
      cooldownUntil,
      debugDetail,
    };
  }
  const windows: Array<[string, string]> = [
    ["five_hour", "5-hour"],
    ["seven_day", "Weekly"],
    ["seven_day_opus", "Weekly · Opus"],
    ["seven_day_sonnet", "Weekly · Sonnet"],
  ];
  const limits: UsageLimitRow[] = [];
  for (const [key, label] of windows) {
    const win = asRecord(rec[key]);
    const util = toInt(win.utilization);
    if (util === null) continue;
    limits.push({
      label,
      used: null,
      limit: null,
      percentUsed: Math.min(100, Math.max(0, util)),
      resetHint: resetAtHint(win.resets_at),
    });
  }
  console.log(`[SignalStack] Claude usage fetch OK — ${limits.length} window(s)`);
  return {
    summary: limits[0] ?? null,
    limits,
    planLabel: "Claude subscription",
    fetchState: "live",
    cooldownUntil: null,
  };
}

// ── ChatGPT / Codex (OAuth access token) ───────────────────────────────
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

async function fetchCodexUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.accessToken}`,
    "User-Agent": "CodexBar",
  };
  const accountId = tokens.accountId ?? codexAccountId(tokens.accessToken);
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;
  const json = await getJson(CODEX_USAGE_URL, headers);
  const rec = asRecord(json);
  const limits: UsageLimitRow[] = [];

  // ChatGPT no longer has a 5-hour bucket — the standard limit is weekly —
  // so derive each window's label from its server-provided duration instead
  // of hardcoding. Code review carries its own rate-limit bucket on paid
  // plans and is surfaced as its own rows when present.
  limits.push(...codexRateLimitRows(asRecord(rec.rate_limit), ""));
  limits.push(...codexRateLimitRows(asRecord(rec.code_review_rate_limit), "Code review · "));

  const planType = readString(rec, "plan_type") ?? codexPlanType(tokens.accessToken);
  return {
    summary: limits[0] ?? null,
    limits,
    planLabel: planType ? `ChatGPT ${planType}` : "ChatGPT subscription",
  };
}

function codexPlanType(token: string | null | undefined): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const auth = asRecord(payload["https://api.openai.com/auth"]);
  return readString(auth, "chatgpt_plan_type") ?? readString(payload, "chatgpt_plan_type");
}

function retryAfterToEpochMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Date.now() + seconds * 1000;
  }
  const absolute = Date.parse(value);
  return Number.isNaN(absolute) ? null : absolute;
}

function codexRateLimitRows(
  rateLimit: Record<string, unknown> | null,
  labelPrefix: string,
): UsageLimitRow[] {
  if (!rateLimit) return [];
  const rows: UsageLimitRow[] = [];
  const primaryRaw = rateLimit.primary_window;
  const primary = codexWindow(primaryRaw, `${labelPrefix}${codexWindowLabel(primaryRaw, "Primary window")}`);
  if (primary) rows.push(primary);
  const secondaryRaw = rateLimit.secondary_window;
  const secondary = codexWindow(
    secondaryRaw,
    `${labelPrefix}${codexWindowLabel(secondaryRaw, "Secondary window")}`,
  );
  if (secondary) rows.push(secondary);
  return rows;
}

function codexWindowLabel(raw: unknown, fallback: string): string {
  if (!isRecord(raw)) return fallback;
  const seconds = toInt(raw.limit_window_seconds);
  if (seconds === null || seconds <= 0) return fallback;
  if (seconds % 604800 === 0) {
    const weeks = seconds / 604800;
    return weeks === 1 ? "Weekly window" : `${weeks}-week window`;
  }
  if (seconds % 86400 === 0) {
    const days = seconds / 86400;
    return days === 1 ? "Daily window" : `${days}-day window`;
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "Hourly window" : `${hours}-hour window`;
  }
  if (seconds % 60 === 0) return `${seconds / 60}-minute window`;
  return fallback;
}

function codexWindow(raw: unknown, label: string): UsageLimitRow | null {
  if (!isRecord(raw)) return null;
  const pct = toInt(raw.used_percent);
  if (pct === null) return null;
  const resetAt = toInt(raw.reset_at);
  return {
    label,
    used: null,
    limit: null,
    percentUsed: Math.min(100, Math.max(0, pct)),
    resetHint: resetAt !== null ? resetEpochHint(resetAt) : null,
  };
}

// ── Gemini CLI (OAuth access token) ────────────────────────────────────
const GEMINI_LOAD_CODE_ASSIST_URL =
  "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const GEMINI_RETRIEVE_QUOTA_URL =
  "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota";
const GEMINI_PROJECTS_URL = "https://cloudresourcemanager.googleapis.com/v1/projects";

async function fetchGeminiUsage(
  tokens: StoredTokens,
  ctx?: UsageFetchContext,
): Promise<SubscriptionUsage> {
  const headers = {
    Authorization: `Bearer ${tokens.accessToken}`,
    "User-Agent": "GeminiCLI",
  };

  try {
    const loadJson = await postJson(GEMINI_LOAD_CODE_ASSIST_URL, headers, {
      metadata: {
        ideType: "GEMINI_CLI",
        pluginType: "GEMINI",
      },
    });
    const load = asRecord(loadJson);
    const planLabel = geminiPlanLabel(load, tokens.idToken);
    const projectId =
      readString(load, "cloudaicompanionProject") ??
      readString(asRecord(load.cloudaicompanionProject), "id") ??
      readString(asRecord(load.metadata), "duetProject") ??
      (await discoverGeminiProjectId(headers));

    const quotaJson = await postJson(
      GEMINI_RETRIEVE_QUOTA_URL,
      headers,
      projectId ? { project: projectId } : {},
    );
    const limits = geminiRows(quotaJson);

    return {
      summary: limits[0] ?? null,
      limits,
      planLabel,
    };
  } catch (error) {
    if (error instanceof HttpError && error.status === 401 && ctx?.refreshTokens) {
      const refreshed = await ctx.refreshTokens();
      if (refreshed) {
        return fetchGeminiUsage(refreshed, { refreshTokens: ctx.refreshTokens });
      }
    }
    throw error;
  }
}

function geminiRows(raw: unknown): UsageLimitRow[] {
  const rec = asRecord(raw);
  const buckets = arrayValue(rec.buckets) ?? [];

  const byModel: Record<string, { percentLeft: number; reset: unknown }> = {};
  for (const item of buckets) {
    const bucket = asRecord(item);
    const model = readString(bucket, "modelId");
    const remainingFraction = toNumber(bucket.remainingFraction);
    if (!model || remainingFraction === null) continue;
    const percentLeft = Math.max(0, Math.min(100, remainingFraction * 100));
    const current = byModel[model];
    if (!current || percentLeft < current.percentLeft) {
      byModel[model] = { percentLeft, reset: bucket.resetTime };
    }
  }

  return Object.entries(byModel)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model, quota]) => ({
      label: geminiBucketLabel(model),
      used: null,
      limit: null,
      percentUsed: Math.round(100 - quota.percentLeft),
      resetHint: resetAtHint(quota.reset),
    }));
}

function geminiBucketLabel(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes("pro")) return "Gemini Pro";
  if (lower.includes("flash-lite")) return "Gemini Flash Lite";
  if (lower.includes("flash")) return "Gemini Flash";
  return model;
}

function geminiPlanLabel(load: Record<string, unknown>, idToken: string | null | undefined): string {
  const tier = readString(load, "currentTier") ?? readString(asRecord(load.currentTier), "id");
  if (tier === "standard-tier") return "Gemini Paid";
  if (tier === "free-tier") return "Gemini Free";
  if (tier === "legacy-tier") return "Gemini Legacy";
  if (tier) return `Gemini ${tier}`;
  const claims = decodeJwtPayload(idToken);
  const hostedDomain = claims ? readString(claims, "hd") : null;
  return hostedDomain ? "Gemini Workspace" : "Gemini subscription";
}

async function discoverGeminiProjectId(headers: Record<string, string>): Promise<string | null> {
  try {
    const json = await getJson(GEMINI_PROJECTS_URL, headers);
    const projects = arrayValue(asRecord(json).projects) ?? [];
    for (const item of projects) {
      const project = asRecord(item);
      const projectId = readString(project, "projectId");
      if (!projectId) continue;
      if (projectId.startsWith("gen-lang-client")) return projectId;
      if (readString(asRecord(project.labels), "generative-language")) return projectId;
    }
  } catch {
    // Quota can still succeed without an explicit project.
  }
  return null;
}


// ── ElevenLabs ─────────────────────────────────────────────────────────
const ELEVENLABS_API_HOST = "https://api.elevenlabs.io";

async function fetchElevenLabsUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const json = await getJson(`${ELEVENLABS_API_HOST}/v1/user/subscription`, {
    "xi-api-key": tokens.accessToken,
  });
  const rec = asRecord(json);
  const characterCount = toInt(rec.character_count) ?? 0;
  const characterLimit = toInt(rec.character_limit) ?? 0;
  const voiceSlotsUsed = toInt(rec.voice_slots_used);
  const voiceLimit = toInt(rec.voice_limit);
  const professionalVoiceSlotsUsed = toInt(rec.professional_voice_slots_used);
  const professionalVoiceLimit = toInt(rec.professional_voice_limit);
  const tier = readString(rec, "tier");
  const status = readString(rec, "status");
  const nextResetUnix = toInt(rec.next_character_count_reset_unix);

  const pct = characterLimit > 0 ? Math.min(100, (characterCount / characterLimit) * 100) : 0;

  const limits: UsageLimitRow[] = [];
  limits.push({
    label: "Character credits",
    used: characterCount,
    limit: characterLimit,
    percentUsed: Math.round(pct),
    resetHint: nextResetUnix !== null ? resetEpochHint(nextResetUnix) : null,
  });

  if (voiceLimit !== null || voiceSlotsUsed !== null) {
    const voicePct = voiceLimit !== null && voiceLimit > 0 ? Math.min(100, ((voiceSlotsUsed ?? 0) / voiceLimit) * 100) : null;
    limits.push({
      label: "Voice slots",
      used: voiceSlotsUsed,
      limit: voiceLimit,
      percentUsed: voicePct !== null ? Math.round(voicePct) : null,
      resetHint: null,
    });
  }

  if (professionalVoiceLimit !== null || professionalVoiceSlotsUsed !== null) {
    const profPct = professionalVoiceLimit !== null && professionalVoiceLimit > 0
      ? Math.min(100, ((professionalVoiceSlotsUsed ?? 0) / professionalVoiceLimit) * 100)
      : null;
    limits.push({
      label: "Pro voice slots",
      used: professionalVoiceSlotsUsed,
      limit: professionalVoiceLimit,
      percentUsed: profPct !== null ? Math.round(profPct) : null,
      resetHint: null,
    });
  }

  const planLabel = tier ? `${tier.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}${status && status !== "active" ? ` · ${status}` : ""}` : "ElevenLabs";

  return { summary: limits[0] ?? null, limits, planLabel };
}

// ── Poe ────────────────────────────────────────────────────────────────
const POE_API_HOST = "https://api.poe.com";

async function fetchPoeUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const json = await getJson(`${POE_API_HOST}/usage/current_balance`, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const rec = asRecord(json);
  const balance = toNumber(rec.current_point_balance) ?? 0;

  return {
    summary: {
      label: "Point balance",
      used: null,
      limit: null,
      percentUsed: null,
      resetHint: `${balance.toLocaleString()} points`,
    },
    limits: [
      {
        label: "Points",
        used: null,
        limit: null,
        percentUsed: null,
        resetHint: `${balance.toLocaleString()} points available`,
      },
    ],
    planLabel: "Poe",
  };
}

// ── Codebuff ───────────────────────────────────────────────────────────
const CODEBUFF_API_HOST = "https://www.codebuff.com";

async function fetchCodebuffUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const usageJson = await postJson(`${CODEBUFF_API_HOST}/api/v1/usage`, {
    Authorization: `Bearer ${tokens.accessToken}`,
  }, { fingerprintId: "signalstack-usage" });
  const usageRec = asRecord(usageJson);
  const used = toNumber(usageRec.used) ?? 0;
  const total = toNumber(usageRec.total) ?? 0;
  const remaining = toNumber(usageRec.remaining) ?? 0;
  const autoTopup = usageRec.auto_topup_enabled === true;
  const nextReset = readString(usageRec, "next_quota_reset");

  const subJson = await getJson(`${CODEBUFF_API_HOST}/api/user/subscription`, {
    Authorization: `Bearer ${tokens.accessToken}`,
  }).catch(() => null);
  const subRec = asRecord(subJson);
  const weeklyUsed = toNumber(subRec.weeklyUsed);
  const weeklyLimit = toNumber(subRec.weeklyLimit);
  const weeklyResetsAt = readString(subRec, "weeklyResetsAt");
  const tier = readString(subRec, "tier");

  const limits: UsageLimitRow[] = [];
  if (total > 0) {
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    limits.push({
      label: "Credits",
      used,
      limit: total,
      percentUsed: Math.round(pct),
      resetHint: nextReset ? `resets ${nextReset}` : `Remaining: ${remaining.toFixed(2)}`,
    });
  }

  if (weeklyLimit !== null || weeklyUsed !== null) {
    const wpct = weeklyLimit !== null && weeklyLimit > 0 ? Math.min(100, ((weeklyUsed ?? 0) / weeklyLimit) * 100) : null;
    limits.push({
      label: "Weekly limit",
      used: weeklyUsed,
      limit: weeklyLimit,
      percentUsed: wpct !== null ? Math.round(wpct) : null,
      resetHint: weeklyResetsAt ? `resets ${weeklyResetsAt}` : null,
    });
  }

  return {
    summary: limits[0] ?? null,
    limits,
    planLabel: tier ? `Codebuff ${tier}` : "Codebuff",
  };
}

// ── Copilot ────────────────────────────────────────────────────────────
const COPILOT_API_HOST = "https://api.github.com";

const copilotDeviceFlow: DeviceFlowConfig = {
  clientId: "Iv1.b507a08c87ecfe98",
  deviceAuthorizationUrl: `https://github.com/login/device/code`,
  tokenUrl: `https://github.com/login/oauth/access_token`,
  scopes: ["read:user"],
  dialect: "standard",
};

async function fetchCopilotUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const json = await getJson(`${COPILOT_API_HOST}/copilot_internal/user`, {
    Authorization: `token ${tokens.accessToken}`,
    Accept: "application/json",
    "Editor-Version": "vscode/1.96.2",
    "Editor-Plugin-Version": "copilot-chat/0.26.7",
    "User-Agent": "GitHubCopilotChat/0.26.7",
    "X-Github-Api-Version": "2025-04-01",
  });
  const rec = asRecord(json);
  const quotaSnapshots = asRecord(rec.quota_snapshots);
  const premium = asRecord(quotaSnapshots.premium_interactions);
  const chat = asRecord(quotaSnapshots.chat);
  const plan = readString(rec, "copilot_plan") ?? "Copilot";
  const tokenBilling = rec.token_based_billing === true;

  const limits: UsageLimitRow[] = [];

  const premiumPct = toInt(premium.used_percent);
  if (premiumPct !== null) {
    limits.push({
      label: "Premium interactions",
      used: null,
      limit: null,
      percentUsed: Math.min(100, Math.max(0, premiumPct)),
      resetHint: null,
    });
  }

  const chatPct = toInt(chat.used_percent);
  if (chatPct !== null) {
    limits.push({
      label: "Chat",
      used: null,
      limit: null,
      percentUsed: Math.min(100, Math.max(0, chatPct)),
      resetHint: null,
    });
  }

  if (tokenBilling && limits.length === 0) {
    limits.push({
      label: "Token-based billing",
      used: null,
      limit: null,
      percentUsed: null,
      resetHint: "Business plan — no fixed quotas",
    });
  }

  return {
    summary: limits[0] ?? null,
    limits,
    planLabel: plan.charAt(0).toUpperCase() + plan.slice(1),
  };
}

// ── Chutes ─────────────────────────────────────────────────────────────
const CHUTES_API_HOST = "https://api.chutes.ai";

async function fetchChutesUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const json = await getJson(`${CHUTES_API_HOST}/users/me/subscription_usage`, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const rec = asRecord(json);
  const rollingWindow = asRecord(rec.rolling_window);
  const monthlyWindow = asRecord(rec.monthly_window);

  const limits: UsageLimitRow[] = [];

  const rollingUsed = toNumber(rollingWindow.used);
  const rollingLimit = toNumber(rollingWindow.limit);
  if (rollingUsed !== null || rollingLimit !== null) {
    const pct = rollingLimit !== null && rollingLimit > 0 ? Math.min(100, ((rollingUsed ?? 0) / rollingLimit) * 100) : null;
    limits.push({
      label: "Rolling (4h)",
      used: rollingUsed,
      limit: rollingLimit,
      percentUsed: pct !== null ? Math.round(pct) : null,
      resetHint: readString(rollingWindow, "resets_at") ?? null,
    });
  }

  const monthlyUsed = toNumber(monthlyWindow.used);
  const monthlyLimit = toNumber(monthlyWindow.limit);
  if (monthlyUsed !== null || monthlyLimit !== null) {
    const pct = monthlyLimit !== null && monthlyLimit > 0 ? Math.min(100, ((monthlyUsed ?? 0) / monthlyLimit) * 100) : null;
    limits.push({
      label: "Monthly",
      used: monthlyUsed,
      limit: monthlyLimit,
      percentUsed: pct !== null ? Math.round(pct) : null,
      resetHint: readString(monthlyWindow, "resets_at") ?? null,
    });
  }

  return { summary: limits[0] ?? null, limits, planLabel: "Chutes" };
}


// ── Factory / Droid ────────────────────────────────────────────────────
const FACTORY_APP_BASE = "https://app.factory.ai";
const FACTORY_API_BASE = "https://api.factory.ai";

async function fetchFactoryUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.accessToken}`,
    Origin: FACTORY_APP_BASE,
    Referer: `${FACTORY_APP_BASE}/`,
    "x-factory-client": "web-app",
  };

  const json = await getJson(`${FACTORY_API_BASE}/api/billing/limits`, headers);
  const rec = asRecord(json);

  // Helpful for debugging shape/value mismatches.

  const planLabel = readString(rec, "plan") ?? readString(asRecord(rec.subscription), "plan") ?? "Factory";
  const limits = parseFactoryLimits(rec.limits ?? rec);

  // Surface available balance only if the API returned credits but no parsable limits.
  const balanceCents =
    toNumber(rec.extraUsageBalanceCents) ??
    toNumber(rec.balance_cents) ??
    toNumber(rec.balanceCents) ??
    toNumber(rec.balance);
  if (limits.length === 0 && balanceCents !== null) {
    limits.push({
      label: "Available balance",
      used: null,
      limit: null,
      percentUsed: null,
      resetHint: `$${(balanceCents / 100).toFixed(2)}`,
    });
  }

  return { summary: limits[0] ?? null, limits, planLabel };
}

async function fetchOpenCodeUsage(tokens: StoredTokens): Promise<SubscriptionUsage> {
  void tokens;

  const limits: UsageLimitRow[] = [
    {
      label: "Monthly spend limit",
      used: null,
      limit: 200,
      percentUsed: null,
      resetHint: "$200/mo included",
    },
    {
      label: "Premium models",
      used: null,
      limit: 50,
      percentUsed: null,
      resetHint: "$50/mo pool",
    },
  ];

  return {
    summary: limits[0],
    limits,
    planLabel: "OpenCode Go",
    debugDetail: "OpenCode docs expose exact usage in the console; Model Pulse stores the key locally and shows documented plan limits.",
  };
}

function parseFactoryLimits(root: unknown): UsageLimitRow[] {
  const rows: UsageLimitRow[] = [];

  let buckets: { name: string; value: unknown }[] = [];
  if (Array.isArray(root)) {
    buckets = root.map((item) => {
      const r = asRecord(item);
      const name = readString(r, "name") ?? readString(r, "bucket") ?? readString(r, "tier") ?? "Bucket";
      return { name, value: item };
    });
  } else if (isRecord(root)) {
    buckets = Object.entries(root)
      .filter(([key]) => key !== "plan" && key !== "subscription")
      .map(([name, value]) => ({ name, value }));
  }

  for (const bucket of buckets) {
    const bucketRec = asRecord(bucket.value);
    const windowsRoot = isRecord(bucketRec.windows) ? bucketRec.windows : bucketRec;

    let windows: { key: string; value: unknown }[] = [];
    if (Array.isArray(windowsRoot)) {
      windows = windowsRoot.map((item) => {
        const r = asRecord(item);
        const key = readString(r, "type") ?? readString(r, "window") ?? readString(r, "name") ?? "window";
        return { key, value: item };
      });
    } else if (isRecord(windowsRoot)) {
      windows = Object.entries(windowsRoot).map(([key, value]) => ({ key, value }));
    }

    for (const win of windows) {
      const winRec = asRecord(win.value);
      const percentUsed = factoryWindowPercentUsed(winRec);
      if (percentUsed === null) continue;

      const seconds =
        toNumber(winRec.secondsRemaining) ??
        toNumber(winRec.seconds_remaining) ??
        toNumber(winRec.ttl) ??
        toNumber(winRec.reset_in);
      const resetHint = seconds !== null && Number.isFinite(seconds) ? secondsHint(seconds) : null;

      rows.push({
        label: `${humanizeFactoryBucket(bucket.name)} · ${factoryWindowLabel(win.key)}`,
        used: null,
        limit: null,
        percentUsed: Math.max(0, Math.min(100, percentUsed)),
        resetHint,
      });
    }
  }

  return rows;
}

function factoryWindowPercentUsed(win: Record<string, unknown>): number | null {
  const usedPercent = toNumber(win.usedPercent ?? win.percentUsed);
  let pct: number | null = null;
  if (usedPercent !== null) {
    // Factory usually returns 0-100, but some buckets return 0-1 fractions.
    // Treat values strictly between 0 and 1 (non-integer) as fractions; keep
    // integer values like 1 as percentages so 1% usage isn't inflated to 100%.
    const isFraction = usedPercent > 0 && usedPercent < 1 && !Number.isInteger(usedPercent);
    pct = isFraction ? usedPercent * 100 : usedPercent;
  } else {
    const remainingPercent = toNumber(win.remainingPercent ?? win.remaining_percent);
    if (remainingPercent !== null) {
      const isFraction = remainingPercent > 0 && remainingPercent < 1 && !Number.isInteger(remainingPercent);
      const normalized = isFraction ? remainingPercent * 100 : remainingPercent;
      pct = 100 - normalized;
    }
    const used = toNumber(win.used);
    const limit = toNumber(win.limit);
    if (used !== null && limit !== null && limit > 0) {
      pct = (used / limit) * 100;
    }
    const remaining = toNumber(win.remaining);
    if (remaining !== null && limit !== null && limit > 0) {
      pct = ((limit - remaining) / limit) * 100;
    }
  }
  if (pct === null) return null;

  // Some buckets (e.g. core) return stale/expired windows whose windowEnd is in
  // the past and secondsRemaining is null. Treat those as reset (0% used).
  const secondsRemaining =
    toNumber(win.secondsRemaining) ??
    toNumber(win.seconds_remaining) ??
    toNumber(win.ttl) ??
    toNumber(win.reset_in);
  const windowEnd = readString(win, "windowEnd") ?? readString(win, "window_end");
  const hasExpiredWindow =
    (secondsRemaining === null || secondsRemaining <= 0) &&
    windowEnd !== null &&
    !Number.isNaN(Date.parse(windowEnd)) &&
    Date.parse(windowEnd) < Date.now();
  if (hasExpiredWindow) return 0;

  return pct;
}

function factoryWindowLabel(key: string): string {
  const map: Record<string, string> = {
    fiveHour: "5-hour",
    fiveMin: "5-min",
    fiveMinute: "5-min",
    hourly: "Hourly",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };
  return map[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function humanizeFactoryBucket(key: string): string {
  if (key === "standard") return "Standard";
  if (key === "core") return "Core";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// ── Registry ───────────────────────────────────────────────────────────
export const SUBSCRIPTION_PROVIDERS: Record<SubscriptionProviderId, SubscriptionProviderDef> = {
  "kimi-sub": {
    id: "kimi-sub",
    label: "Kimi (subscription)",
    shortLabel: "Kimi",
    accent: "#91B7FF",
    authKind: "device-flow",
    deviceFlow: kimiDeviceFlow,
    fetchUsage: fetchKimiUsage,
  },
  "minimax-sub": {
    id: "minimax-sub",
    label: "MiniMax (subscription)",
    shortLabel: "MiniMax",
    accent: "#F2B278",
    authKind: "device-flow",
    deviceFlow: minimaxDeviceFlow,
    fetchUsage: fetchMinimaxUsage,
  },
  "zai-sub": {
    id: "zai-sub",
    label: "Z.ai GLM (subscription)",
    shortLabel: "Z.ai",
    accent: "#72E3AD",
    authKind: "api-token",
    tokenHint: "Paste your Z.ai API token (ANTHROPIC_AUTH_TOKEN) from z.ai dashboard.",
    fetchUsage: fetchZaiUsage,
  },
  "claude-sub": {
    id: "claude-sub",
    label: "Claude (subscription)",
    shortLabel: "Claude",
    accent: "#F2B278",
    authKind: "pkce-code",
    tokenHint:
      "Sign in with your Claude account in the browser, then paste the code it shows you. Model Pulse gets its own token — it will NOT log out or conflict with Claude Code on your Mac.",
    setupSteps: [
      "Tap Connect Claude — your browser opens claude.ai.",
      "Sign in and approve access.",
      "Copy the code the page shows and paste it back here.",
    ],
    // Anthropic's public OAuth client (the one Claude Code uses). The
    // authorization-code + PKCE flow gives SignalStack an independent
    // refresh-token chain, so refreshing here never invalidates the Claude
    // Code CLI's credential (Anthropic rotates refresh tokens on every use —
    // sharing one credential between two clients breaks both).
    pkceCodeFlow: {
      authorizeUrl: "https://claude.ai/oauth/authorize",
      tokenUrl: "https://console.anthropic.com/v1/oauth/token",
      clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
      redirectUri: "https://console.anthropic.com/oauth/code/callback",
      scopes: ["org:create_api_key", "user:profile", "user:inference"],
    },
    tokenRefresh: {
      // Claude Code's public OAuth client_id. The previous value here was the
      // client *metadata document URL*, which Anthropic's token endpoint
      // rejects — so refreshes silently failed and the stale access token
      // eventually surfaced as the edge-throttled 429 ("Anthropic-side rate
      // limiting"). With the real client_id the refresh_token grant succeeds
      // and SignalStack can keep the access token alive without re-pasting.
      tokenUrl: "https://console.anthropic.com/v1/oauth/token",
      clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
      bodyFormat: "json",
    },
    fetchUsage: fetchClaudeUsage,
    // With a valid OAuth token + claude-code User-Agent we're in the same
    // generous rate-limit bucket as Claude Code itself; 15 min is well below
    // any radar while keeping the data reasonably fresh. A real 429's
    // retry-after is still honored if it ever happens.
    minFetchIntervalMs: 15 * 60 * 1000,
  },
  "codex-sub": {
    id: "codex-sub",
    label: "ChatGPT / Codex (subscription)",
    shortLabel: "ChatGPT",
    accent: "#A0E7C5",
    authKind: "api-token",
    tokenHint:
      "Paste your Codex access_token from ~/.codex/auth.json. Run 'codex' on your computer to log in, then copy the token. You can also paste the full JSON file contents. Auto-refreshes when a refresh token is included.",
    setupSteps: [
      "On your Mac, open Terminal and run Codex once so ChatGPT is logged in.",
      "Print ~/.codex/auth.json, then paste the full JSON here.",
      "Model Pulse extracts the access token, refresh token, account id, and plan claims.",
    ],
    helperCommand: "cat ~/.codex/auth.json",
    tokenRefresh: {
      tokenUrl: "https://auth.openai.com/oauth/token",
      clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
      scopes: ["openid", "profile", "email", "offline_access"],
    },
    fetchUsage: fetchCodexUsage,
  },
  "gemini-sub": {
    id: "gemini-sub",
    label: "Gemini CLI (subscription)",
    shortLabel: "Gemini",
    accent: "#0A84FF",
    authKind: "api-token",
    tokenHint:
      "Paste your Gemini CLI OAuth access token from ~/.gemini/oauth_creds.json. You can also paste the full JSON file contents. Desktop login required once; re-paste if the token expires.",
    setupSteps: [
      "On your Mac, run Gemini CLI once and sign in with Google.",
      "Print ~/.gemini/oauth_creds.json, then paste the full JSON here.",
      "Model Pulse reads Gemini Code Assist quota buckets from that OAuth token.",
    ],
    helperCommand: "cat ~/.gemini/oauth_creds.json",
    tokenRefresh: {
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
      clientSecret: "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",
    },
    fetchUsage: fetchGeminiUsage,
  },
  "elevenlabs-sub": {
    id: "elevenlabs-sub",
    label: "ElevenLabs (API)",
    shortLabel: "ElevenLabs",
    accent: "#10B981",
    authKind: "api-token",
    tokenHint: "Paste your ElevenLabs API key from elevenlabs.io/app/settings/api-keys.",
    fetchUsage: fetchElevenLabsUsage,
  },
  "poe-sub": {
    id: "poe-sub",
    label: "Poe (API)",
    shortLabel: "Poe",
    accent: "#EC4899",
    authKind: "api-token",
    tokenHint: "Paste your Poe API key from poe.com/api/keys.",
    fetchUsage: fetchPoeUsage,
  },
  "codebuff-sub": {
    id: "codebuff-sub",
    label: "Codebuff (API)",
    shortLabel: "Codebuff",
    accent: "#F59E0B",
    authKind: "api-token",
    tokenHint: "Paste your Codebuff API key or session token from ~/.config/manicode/credentials.json.",
    fetchUsage: fetchCodebuffUsage,
  },
  "copilot-sub": {
    id: "copilot-sub",
    label: "GitHub Copilot",
    shortLabel: "Copilot",
    accent: "#6E5494",
    authKind: "device-flow",
    deviceFlow: copilotDeviceFlow,
    fetchUsage: fetchCopilotUsage,
  },
  "chutes-sub": {
    id: "chutes-sub",
    label: "Chutes (API)",
    shortLabel: "Chutes",
    accent: "#3B82F6",
    authKind: "api-token",
    tokenHint: "Paste your Chutes API key from chutes.ai/docs/getting-started/authentication.",
    fetchUsage: fetchChutesUsage,
  },
  "factory-sub": {
    id: "factory-sub",
    label: "Factory (API)",
    shortLabel: "Factory",
    accent: "#8B5CF6",
    authKind: "api-token",
    tokenHint: "Paste your Factory API key from app.factory.ai → Settings → API Keys. Factory does not expose an OAuth login, so an API key is required.",
    fetchUsage: fetchFactoryUsage,
  },
  "opencode-sub": {
    id: "opencode-sub",
    label: "OpenCode Go",
    shortLabel: "OpenCode",
    accent: "#FF7A59",
    authKind: "api-token",
    tokenHint: "Paste your OpenCode API key from the OpenCode console. OpenCode Go tracks exact usage in the console; Model Pulse stores the key locally and shows documented plan limits.",
    setupSteps: [
      "Open opencode.ai and sign in.",
      "Create or copy an API key from the OpenCode console.",
      "Paste the key here to track OpenCode Go alongside your other providers.",
    ],
    fetchUsage: fetchOpenCodeUsage,
  },
};
export const SUBSCRIPTION_PROVIDER_ORDER: SubscriptionProviderId[] = [
  "kimi-sub",
  "minimax-sub",
  "zai-sub",
  "claude-sub",
  "codex-sub",
  "gemini-sub",
  "elevenlabs-sub",
  "poe-sub",
  "codebuff-sub",
  "copilot-sub",
  "chutes-sub",
  "factory-sub",
  "opencode-sub",
];

// ── helpers ────────────────────────────────────────────────────────────
async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as Record<string, unknown>;
      message =
        readString(body, "message") ??
        readString(asRecord(body.error), "message") ??
        (typeof body.error === "string" ? body.error : message);
    } catch {
      // keep status message
    }
    throw new HttpError(response.status, message, response.headers.get("retry-after"));
  }
  return response.json();
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter: string | null,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const json = (await response.json()) as Record<string, unknown>;
      message =
        readString(json, "message") ??
        readString(asRecord(json.error), "message") ??
        (typeof json.error === "string" ? json.error : message);
    } catch {
      // keep status message
    }
    throw new HttpError(response.status, message, response.headers.get("retry-after"));
  }
  return response.json();
}

// Decode the ChatGPT account id from the OAuth access/id token (JWT).
// CodexBar reads `https://api.openai.com/auth` -> `chatgpt_account_id`.
function codexAccountId(token: string | null | undefined): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const auth = asRecord(payload["https://api.openai.com/auth"]);
  return (
    readString(auth, "chatgpt_account_id") ??
    readString(payload, "chatgpt_account_id") ??
    readString(payload, "account_id")
  );
}

export function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Decode a base64url string to a UTF-8 string without relying on atob/Buffer,
// which are not consistently available under Hermes.
function base64UrlDecode(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of b64) {
    if (ch === "=") break;
    const value = B64_ALPHABET.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return utf8Decode(bytes);
}

function utf8Decode(bytes: number[]): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i++];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else if (byte >= 0xc0 && byte < 0xe0) {
      result += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (byte >= 0xe0 && byte < 0xf0) {
      result += String.fromCharCode(
        ((byte & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f),
      );
    } else {
      const code =
        ((byte & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
      const adjusted = code - 0x10000;
      result += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const next = value[key];
  return typeof next === "string" && next.length > 0 ? next : null;
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function percent(used: number | null, limit: number | null): number | null {
  if (used === null || limit === null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

function secondsHint(value: unknown): string | null {
  const seconds = toInt(value);
  if (seconds === null || seconds <= 0) return null;
  if (seconds >= 86400) return `resets in ${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `resets in ${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `resets in ${Math.round(seconds / 60)}m`;
  return `resets in ${seconds}s`;
}

function resetHint(raw: Record<string, unknown>): string | null {
  for (const key of ["reset_at", "resetAt", "reset_time", "resetTime"]) {
    const value = readString(raw, key);
    if (value) return `resets ${value}`;
  }
  return secondsHint(raw.reset_in ?? raw.resetIn ?? raw.ttl);
}

function resetAtHint(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  return relativeFromNow(ts);
}

function resetEpochHint(epochSeconds: number): string | null {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return null;
  return relativeFromNow(epochSeconds * 1000);
}

function relativeFromNow(targetMs: number): string | null {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "resets soon";
  const seconds = Math.round(diff / 1000);
  if (seconds >= 86400) return `resets in ${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `resets in ${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `resets in ${Math.round(seconds / 60)}m`;
  return `resets in ${seconds}s`;
}


function humanizeRetry(value: string | null | undefined): string | null {
  if (!value) return null;
  const secs = Number(value);
  // Anthropic's retry-after is often 0 or a non-numeric placeholder here.
  // Treat anything non-positive as "no usable hint" rather than echoing "0".
  if (!Number.isFinite(secs) || secs <= 0) return null;
  if (secs < 60) return `${Math.round(secs)} sec`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(secs / 360) / 10;
  return `${hrs} hr`;
}
