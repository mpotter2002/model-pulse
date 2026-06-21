import { demoSnapshot } from "@/lib/providers";
import type { ProviderConfig, ProviderId, ProviderSnapshot } from "@/types/domain";

export async function buildSnapshot(providerId: ProviderId, config: ProviderConfig, demoMode: boolean) {
  if (demoMode) {
    return demoSnapshot(providerId);
  }

  if (providerId === "openai") {
    return refreshOpenAI(config);
  }

  if (providerId === "anthropic") {
    return refreshAnthropic(config);
  }

  if (providerId === "kimi") {
    return refreshKimi(config);
  }

  return refreshManualProvider(providerId, config);
}

async function refreshOpenAI(config: ProviderConfig): Promise<ProviderSnapshot> {
  if (!config.adminKey) {
    return {
      ...demoSnapshot("openai"),
      statusLabel: "Admin key needed",
      note: "OpenAI usage and cost reporting can be fetched live once an admin key is stored. Limits can still be entered manually.",
    };
  }

  const startTime = Math.floor(Date.now() / 1000) - 60 * 60 * 24;
  const [usageJson, costsJson] = await Promise.all([
    fetchJson(`https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&bucket_width=1d&limit=1`, {
      headers: {
        Authorization: `Bearer ${config.adminKey}`,
      },
    }),
    fetchJson(`https://api.openai.com/v1/organization/costs?start_time=${startTime}&bucket_width=1d&limit=1`, {
      headers: {
        Authorization: `Bearer ${config.adminKey}`,
      },
    }),
  ]);

  const usageBucket = readArrayPath(usageJson, ["data", 0, "results"]);
  const costBucket = readArrayPath(costsJson, ["data", 0, "results"]);
  const tokensUsed = usageBucket.reduce(
    (sum, item) => sum + readNumber(item, "input_tokens") + readNumber(item, "output_tokens"),
    0,
  );
  const requestsUsed = usageBucket.reduce((sum, item) => sum + readNumber(item, "num_model_requests"), 0);
  const monthlySpendUsd = costBucket.reduce((sum, item) => sum + readNestedNumber(item, ["amount", "value"]), 0);

  return {
    statusLabel: "Live org usage",
    note: "Usage and cost are being fetched from the OpenAI admin API. RPM and TPM still rely on your manual caps unless a stronger rate-limit source is added.",
    usage: {
      tokensUsed,
      requestsUsed,
      monthlySpendUsd,
      windowLabel: "Last 24 hours",
    },
    limits: {
      requestsPerMinuteLimit: toNumber(config.requestsPerMinuteLimit),
      requestsRemaining: null,
      tokensPerMinuteLimit: toNumber(config.tokensPerMinuteLimit),
      resetsAtLabel: "Manual caps",
    },
    balanceLabel: null,
    updatedAtLabel: timeLabel(),
  };
}

async function refreshAnthropic(config: ProviderConfig): Promise<ProviderSnapshot> {
  if (!config.adminKey) {
    return {
      ...demoSnapshot("anthropic"),
      statusLabel: "Admin key needed",
      note: "Anthropic usage, cost, and organization rate limits can be fetched live once an Admin API key is stored.",
    };
  }

  const endingAt = new Date();
  const startingAt = new Date(endingAt.getTime() - 24 * 60 * 60 * 1000);
  const headers = {
    "anthropic-version": "2023-06-01",
    "x-api-key": config.adminKey,
  };

  const [usageJson, costJson, limitsJson] = await Promise.all([
    fetchJson(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(startingAt.toISOString())}&ending_at=${encodeURIComponent(endingAt.toISOString())}&bucket_width=1d`,
      { headers },
    ),
    fetchJson(
      `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${encodeURIComponent(startingAt.toISOString())}&ending_at=${encodeURIComponent(endingAt.toISOString())}`,
      { headers },
    ),
    fetchJson("https://api.anthropic.com/v1/organizations/rate_limits", { headers }),
  ]);

  const tokensUsed = sumFieldsDeep(usageJson, [
    "uncached_input_tokens",
    "input_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "output_tokens",
  ]);
  const requestsUsed = sumFieldsDeep(usageJson, ["requests", "request_count", "api_requests"]);
  const monthlySpendUsd = sumCurrencyFields(costJson, [
    "amount_cents",
    "cost_cents",
    "usd_cents",
    "amount",
    "cost",
  ]);
  const modelGroup = findAnthropicModelGroup(limitsJson);
  const requestsPerMinuteLimit = findLimitValue(modelGroup, "requests_per_minute") ?? toNumber(config.requestsPerMinuteLimit);
  const tokensPerMinuteLimit =
    findLimitValue(modelGroup, "input_tokens_per_minute") ?? toNumber(config.tokensPerMinuteLimit);

  return {
    statusLabel: "Live admin telemetry",
    note: "Anthropic usage, cost, and organization rate limits are being read from the Admin API.",
    usage: {
      tokensUsed,
      requestsUsed,
      monthlySpendUsd,
      windowLabel: "Last 24 hours",
    },
    limits: {
      requestsPerMinuteLimit,
      requestsRemaining: null,
      tokensPerMinuteLimit,
      resetsAtLabel: "Rolling minute",
    },
    balanceLabel: null,
    updatedAtLabel: timeLabel(),
  };
}

async function refreshKimi(config: ProviderConfig): Promise<ProviderSnapshot> {
  if (!config.apiKey) {
    return {
      ...demoSnapshot("kimi"),
      statusLabel: "API key needed",
      note: "Kimi can at least provide live account balance once an API key is stored. Usage and rate limits remain partly manual in this prototype.",
    };
  }

  const balanceJson = await fetchJson("https://api.moonshot.ai/v1/users/me/balance", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  const fallback = demoSnapshot("kimi");
  const availableBalance = firstNumberDeep(balanceJson, [
    "available_balance",
    "availableBalance",
    "balance",
    "cash_balance",
    "cashBalance",
  ]);

  return {
    ...fallback,
    statusLabel: typeof availableBalance === "number" ? "Live balance connected" : "Live key connected",
    note:
      typeof availableBalance === "number"
        ? "Kimi account balance is live. Request and token usage still rely on your manual caps until a stronger telemetry path is added."
        : "Kimi key is connected, but the balance payload did not expose a parsable numeric field.",
    limits: {
      requestsPerMinuteLimit: toNumber(config.requestsPerMinuteLimit) ?? fallback.limits.requestsPerMinuteLimit,
      requestsRemaining: fallback.limits.requestsRemaining,
      tokensPerMinuteLimit: toNumber(config.tokensPerMinuteLimit) ?? fallback.limits.tokensPerMinuteLimit,
      resetsAtLabel: fallback.limits.resetsAtLabel,
    },
    balanceLabel: formatBalanceLabel(availableBalance),
  };
}

async function refreshManualProvider(providerId: ProviderId, config: ProviderConfig): Promise<ProviderSnapshot> {
  const fallback = demoSnapshot(providerId);

  return {
    ...fallback,
    statusLabel: config.apiKey ? "Manual limits + key stored" : "Manual setup",
    note: config.apiKey
      ? `${fallback.note} Live request telemetry for this provider still needs a hardened endpoint strategy.`
      : `${fallback.note} Add keys and caps in Connections to move beyond the placeholder state.`,
    limits: {
      requestsPerMinuteLimit: toNumber(config.requestsPerMinuteLimit) ?? fallback.limits.requestsPerMinuteLimit,
      requestsRemaining: fallback.limits.requestsRemaining,
      tokensPerMinuteLimit: toNumber(config.tokensPerMinuteLimit) ?? fallback.limits.tokensPerMinuteLimit,
      resetsAtLabel: fallback.limits.resetsAtLabel,
    },
  };
}

async function fetchJson(url: string, options: RequestInit) {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const errorJson = (await response.json()) as { error?: { message?: string } | string; message?: string };
      message =
        typeof errorJson.error === "string"
          ? errorJson.error
          : errorJson.error?.message ?? errorJson.message ?? message;
    } catch {
      // Ignore JSON parsing errors on non-JSON error bodies.
    }

    throw new Error(message);
  }

  return response.json();
}

function readArrayPath(value: unknown, path: Array<string | number>) {
  const result = path.reduce<unknown>((current, key) => {
    if (Array.isArray(current) && typeof key === "number") return current[key];
    if (current && typeof current === "object" && typeof key === "string") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, value);

  return Array.isArray(result) ? result : [];
}

function readNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object") return 0;
  const next = (value as Record<string, unknown>)[key];
  if (typeof next === "number") return next;
  if (typeof next === "string") {
    const parsed = Number(next);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readNestedNumber(value: unknown, path: string[]) {
  const result = path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);

  if (typeof result === "number") return result;
  if (typeof result === "string") {
    const parsed = Number(result);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sumFieldsDeep(value: unknown, fieldNames: string[]) {
  let total = 0;

  walkUnknown(value, (entry) => {
    if (!entry || typeof entry !== "object") return;
    for (const fieldName of fieldNames) {
      total += readNumber(entry, fieldName);
    }
  });

  return total;
}

function sumCurrencyFields(value: unknown, fieldNames: string[]) {
  let cents = 0;
  let dollars = 0;

  walkUnknown(value, (entry) => {
    if (!entry || typeof entry !== "object") return;
    for (const fieldName of fieldNames) {
      const next = (entry as Record<string, unknown>)[fieldName];
      if (typeof next !== "number" && typeof next !== "string") continue;
      const parsed = Number(next);
      if (!Number.isFinite(parsed)) continue;
      if (fieldName.includes("cents")) cents += parsed;
      else dollars += parsed;
    }
  });

  return dollars + cents / 100;
}

function firstNumberDeep(value: unknown, fieldNames: string[]) {
  let result: number | null = null;

  walkUnknown(value, (entry) => {
    if (result !== null || !entry || typeof entry !== "object") return;

    for (const fieldName of fieldNames) {
      const next = (entry as Record<string, unknown>)[fieldName];
      if (typeof next === "number" && Number.isFinite(next)) {
        result = next;
        return;
      }
      if (typeof next === "string") {
        const parsed = Number(next);
        if (Number.isFinite(parsed)) {
          result = parsed;
          return;
        }
      }
    }
  });

  return result;
}

function walkUnknown(value: unknown, visitor: (entry: unknown) => void) {
  visitor(value);

  if (Array.isArray(value)) {
    value.forEach((entry) => walkUnknown(entry, visitor));
    return;
  }

  if (!value || typeof value !== "object") return;
  Object.values(value).forEach((entry) => walkUnknown(entry, visitor));
}

function findAnthropicModelGroup(value: unknown) {
  let result: Record<string, unknown> | null = null;

  walkUnknown(value, (entry) => {
    if (result || !entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const groupType = (entry as Record<string, unknown>).group_type;
    if (groupType === "model_group") {
      result = entry as Record<string, unknown>;
    }
  });

  return result;
}

function findLimitValue(group: Record<string, unknown> | null, type: string) {
  if (!group) return null;

  const limits = group.limits;
  if (!Array.isArray(limits)) return null;

  for (const limit of limits) {
    if (!limit || typeof limit !== "object") continue;
    const typed = limit as Record<string, unknown>;
    if (typed.type !== type) continue;
    const value = typed.value;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function toNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBalanceLabel(value: number | null) {
  return typeof value === "number" ? `$${value.toFixed(2)} available` : null;
}
