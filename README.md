# Model Pulse

Model Pulse is an Expo prototype for an iPhone app that tracks AI subscription usage, spend, and rate limits in one place, with UI designed to map cleanly into a future iOS widget.

## Current Prototype

- Expo Router app with a dashboard, provider detail screens, and connection settings
- Demo mode enabled by default so the product is usable immediately
- Secure local storage for provider keys and manual limit caps via `expo-secure-store`
- Widget-style preview cards on the home screen for small and medium widget concepts
- Live OpenAI org usage and cost fetch path using admin credentials
- Anthropic and Kimi scaffolded as provider connectors with manual fallback mode

## Important Product Constraint

An actual iPhone Home Screen widget will require a native iOS widget extension. Expo Go cannot ship that by itself. The current app is intentionally structured so the same snapshot model can later feed:

1. A native widget extension in an iOS development build
2. A small backend or edge function that polls provider telemetry safely
3. Timeline entries for WidgetKit

## Why The Prototype Uses Manual Fallbacks

- OpenAI has a practical admin usage/cost API path for org telemetry
- Anthropic and Kimi support in this prototype starts with manual caps and demo/live placeholders because their telemetry surface needs more provider-specific hardening
- Storing admin keys on-device is acceptable for a private prototype, but not the right long-term production architecture

## Run It

```bash
cd /Users/michaelpotter/AIProjects/projects/ai-subscriptions-widget
npm install
npm run start
```

Useful checks:

```bash
npm run typecheck
npx expo export --platform web
```

## Next Steps

1. Add a small backend that normalizes OpenAI, Anthropic, and Kimi telemetry into one schema.
2. Promote Anthropic from manual mode to a real usage/rate-limit connector.
3. Add historical charts and alert thresholds.
4. Create an iOS development build and add a WidgetKit extension.
5. Publish an internal preview build with EAS once the widget target exists.
