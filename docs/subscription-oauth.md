# Subscription OAuth Scaffolding

SignalStack now has backend route scaffolding for provider subscription OAuth:

- `GET /api/subscription-oauth/capabilities`
- `GET /api/subscription-oauth/start?provider=openai`
- `GET /api/subscription-oauth/callback?provider=openai&code=...`

This is intentionally scaffold-only today. OpenAI, Anthropic, and Kimi do not currently expose personal ChatGPT Plus / Claude Pro / Kimi subscription usage, token totals, or subscription rate limits through a public OAuth telemetry API.

## Why This Is Not Supabase-First

Supabase is not required to prove the route shape. These routes can be hosted as Expo API routes and later connected to any token vault:

- Expo API route plus encrypted database row
- Supabase Postgres with Row Level Security
- Cloudflare Workers plus KV/D1
- A native companion app that reads local browser/session state with explicit user consent

The important boundary is that official OAuth tokens and scraped/local session state are different products. Official OAuth can be hosted as a normal backend. Local session access needs a desktop helper and stricter user consent because it may depend on browser cookies, local app state, or private endpoints.

## Environment Variables

The scaffold expects per-provider OAuth settings if a provider later exposes an official telemetry API:

- `SIGNALSTACK_OPENAI_OAUTH_CLIENT_ID`
- `SIGNALSTACK_OPENAI_OAUTH_CLIENT_SECRET`
- `SIGNALSTACK_OPENAI_OAUTH_AUTHORIZE_URL`
- `SIGNALSTACK_OPENAI_OAUTH_TOKEN_URL`
- `SIGNALSTACK_ANTHROPIC_OAUTH_CLIENT_ID`
- `SIGNALSTACK_ANTHROPIC_OAUTH_CLIENT_SECRET`
- `SIGNALSTACK_ANTHROPIC_OAUTH_AUTHORIZE_URL`
- `SIGNALSTACK_ANTHROPIC_OAUTH_TOKEN_URL`
- `SIGNALSTACK_KIMI_OAUTH_CLIENT_ID`
- `SIGNALSTACK_KIMI_OAUTH_CLIENT_SECRET`
- `SIGNALSTACK_KIMI_OAUTH_AUTHORIZE_URL`
- `SIGNALSTACK_KIMI_OAUTH_TOKEN_URL`

Until a provider exposes official subscription telemetry scopes, the routes return `501` with a plain explanation instead of pretending the integration exists.
