# Model Pulse

Track your AI subscription rate limits and API spend from your iPhone Home
Screen. Model Pulse shows live rate-limit windows, monthly spend, and token
usage for the AI providers you already use — in the app and in Home Screen
widgets.

Privacy policy & support: https://mpotter2002.github.io/model-pulse/

## Features

- **Home Screen widgets** — small, medium, and large WidgetKit widgets with
  bar, dot, or dash limit styles
- **Subscription tracking** — rate-limit windows and reset times for ChatGPT
  (weekly window) and Claude (5-hour / weekly), with secure sign-in flows
  (no terminals, no copy-pasting tokens)
- **API spend** — month-to-date spend and 24-hour token/request tracking for
  OpenAI and Anthropic organization accounts via Admin API keys, with
  optional monthly budgets
- **Usage alerts** — optional local notifications when you cross thresholds
  you pick (25–95%), for both subscription windows and API budgets. Alerts
  are scheduled and fire entirely on-device
- **Privacy first** — no accounts, no analytics, no tracking, no server.
  Credentials live in the iOS Keychain; requests go straight from your
  device to the provider

## Tech

- Expo SDK 56 (React Native), Expo Router, TypeScript
- Native WidgetKit extension target (see `plugins/` for the config plugins
  that wire up fonts and the widget target)
- `expo-secure-store` for credentials, `expo-notifications` +
  `expo-background-task` for usage alerts
- Fonts: Space Grotesk & Space Mono (SIL Open Font License) via
  `@expo-google-fonts`

## Run it

A development build is required — the widget extension cannot run in Expo Go.

```bash
npm install
npx expo run:ios        # local dev build with the widget target
```

Useful checks:

```bash
npm run typecheck
```

## Build for release

```bash
npx eas-cli build --platform ios --profile production
```

## Disclaimer

Model Pulse is an independent tracker and is not affiliated with or endorsed
by OpenAI, Anthropic, Google, Moonshot, or any other listed provider. All
provider names and logos belong to their respective owners.

## License

MIT — see [LICENSE](LICENSE).
