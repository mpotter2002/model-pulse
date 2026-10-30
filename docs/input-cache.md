# API input cache breakdown

OpenAI and Anthropic API connections now show fresh input tokens, cache-read tokens, and cache reuse for the last 24 hours next to monthly spend. Detail views also show cache writes. API Home cards show a compact breakdown; subscription views retain their rate limits.

OpenAI's organization completion usage API includes cached input in `input_tokens`. Fresh input is `input_tokens - input_cached_tokens`; cache writes are not separately reported. Anthropic's usage report separates `uncached_input_tokens`, `cache_read_input_tokens`, and `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`. Both write durations count toward input totals and the reuse denominator. Output tokens never enter the ratio.

Cache reuse = cache reads / (fresh input + cache reads + separately reported cache writes). Zero input has no percentage. Missing or invalid fields are unavailable, not zero. No dollar savings are estimated: model pricing, write duration, and batch pricing affect those calculations.

Report pagination is followed for usage and costs. Incomplete pagination fails the refresh rather than publishing partial totals. OpenAI uses hourly buckets over the requested 24-hour interval. Anthropic report `amount` values are USD cents, including decimal strings; monthly spend converts them to dollars.

These metrics require the existing API/admin connection, not Claude or ChatGPT subscription authentication. Other providers do not currently supply a cache breakdown. Refresh existing API connections after installing; old snapshots remain valid and gain cache fields on refresh.

Validation: `node tests/input-cache.cjs`, typecheck, notification and widget regression checks, and iOS export. Tests cover actual report field structures, multi-page totals, missing/invalid fields, no usage, non-duplicated input totals, cents conversion, and failed partial reports. Physical-device layout and live account data require TestFlight testing.

References:
- https://platform.claude.com/docs/en/api/beta/organization/usage_report/retrieve_messages
- https://platform.claude.com/docs/en/api/beta/organization/cost_report/retrieve
