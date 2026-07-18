# Model Pulse — App Store listing (draft)

## Subtitle (30 char max)
AI usage, limits & spend

## Promotional text (170 char max, editable anytime without review)
Track every AI subscription and API budget from your Home Screen. Live
rate-limit windows, monthly spend, and plan usage for OpenAI, Anthropic,
Kimi, and more.

## Description (4000 char max)
Model Pulse puts your AI subscriptions and API spend on your iPhone Home
Screen, so you always know how much runway you have left.

HOME SCREEN WIDGETS
- Small, medium, and large widgets
- See 5-hour and weekly plan windows, monthly spend, and token burn at a
  glance
- Bar, dot, or dash limit styles to match your setup

SUBSCRIPTIONS
- Track plan usage for ChatGPT, Claude, Gemini, and more
- 5-hour and weekly rate-limit windows with reset times
- Sign in securely — tokens are stored in the iOS Keychain and never leave
  your device except to talk to the provider

API SPEND
- Month-to-date spend for OpenAI and Anthropic organization accounts
- 24-hour token and request tracking
- Optional monthly budgets to pace prepaid credits

YOUR DATA STAYS YOURS
Model Pulse has no accounts, no analytics, and no tracking. Keys live in
the iOS Keychain. Requests go straight from your device to the providers
you connect — there is no Model Pulse server.

## Keywords (100 char max, comma-separated)
ai,usage tracker,rate limits,api spend,openai,anthropic,claude,chatgpt,kimi,widget,tokens

## Categories
- Primary: Utilities
- Secondary: Developer Tools

## Age rating
4+ (no objectionable content, no UGC, no gambling, no unrestricted web)

## URLs
- Support URL: https://mpotter2002.github.io/model-pulse/
- Privacy policy URL: https://mpotter2002.github.io/model-pulse/privacy.html
- Marketing URL: (optional, leave blank)

## App privacy (App Store Connect questionnaire)
- Data collection: **No** ("Data Not Collected"). No analytics, no accounts,
  no server. Keys stay in the iOS Keychain; requests go device → provider.
- Encryption: exempt (ITSAppUsesNonExemptEncryption = false, already in the
  binary — answer "No" to non-exempt encryption if asked).

## Review notes for Apple (suggestion)
Model Pulse displays usage, rate-limit, and spend data for third-party AI
providers (OpenAI, Anthropic, and others) that the user already has accounts
with. No sign-in or account is required to review the app: on first launch,
cards show clearly-labeled "not connected" / "key needed" placeholder states,
and every screen — provider details, settings, widget configuration — is
fully reachable without credentials. Live data is fetched directly from each
provider's official API using keys or OAuth sign-ins the user supplies;
credentials are stored only in the iOS Keychain and there is no Model Pulse
server or account system.

The app offers optional local notifications ("Usage alerts" in Settings).
Notification permission is requested only when the user turns that toggle on
— never at launch. The Background Processing mode is used solely to
periodically refresh usage numbers so those threshold alerts can fire while
the app is closed. No data leaves the device except requests to the
providers the user connected.

Subscriptions are the user's own existing provider subscriptions; the app
sells nothing and contains no in-app purchases.
