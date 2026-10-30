import type { InputCacheUsage } from "@/types/domain";

type Row = Record<string, unknown>;
function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function sum(rows: Row[], read: (row: Row) => number | null): number | null {
  let total = 0;
  for (const row of rows) {
    const value = read(row);
    if (value === null) return null;
    total += value;
  }
  return total;
}

export function usageRows(response: unknown): Row[] {
  const data = (response as { data?: { results?: Row[] }[] })?.data;
  return Array.isArray(data) ? data.flatMap((bucket) => Array.isArray(bucket.results) ? bucket.results : []) : [];
}

export function inputCacheUsage(provider: "openai" | "anthropic", rows: Row[]): InputCacheUsage {
  const cacheReadTokens = sum(rows, (row) => number(provider === "openai" ? row.input_cached_tokens : row.cache_read_input_tokens));
  const freshInputTokens = sum(rows, (row) => {
    if (provider === "anthropic") return number(row.uncached_input_tokens);
    const input = number(row.input_tokens);
    const cached = number(row.input_cached_tokens);
    // OpenAI's input total already includes cached input.
    return input === null || cached === null || cached > input ? null : input - cached;
  });
  const cacheWriteTokens = provider === "openai" ? null : sum(rows, (row) => {
    const creation = row.cache_creation as Row | undefined;
    const fiveMinutes = number(creation?.ephemeral_5m_input_tokens);
    const oneHour = number(creation?.ephemeral_1h_input_tokens);
    return fiveMinutes === null || oneHour === null ? null : fiveMinutes + oneHour;
  });
  const denominator = freshInputTokens === null || cacheReadTokens === null || (provider === "anthropic" && cacheWriteTokens === null)
    ? null : freshInputTokens + cacheReadTokens + (cacheWriteTokens ?? 0);
  return {
    freshInputTokens, cacheReadTokens, cacheWriteTokens,
    cacheReusePercent: denominator !== null && denominator > 0 ? cacheReadTokens! / denominator * 100 : null,
    windowLabel: "Last 24 hours",
  };
}
