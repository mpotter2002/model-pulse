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
- Month-to-date spend for OpenAI, Anthropic, OpenRouter, and fal.ai
- 24-hour token and request tracking
- OpenRouter key credit caps and fal.ai workspace credit balance
- Optional OpenRouter spend, requests, and token breakdown by model
- Optional monthly budgets to pace prepaid credits

USAGE ALERTS
- Optional notifications when you cross usage thresholds you pick (25-95%)
- Works for subscription rate-limit windows and API monthly budgets
- Delivered on-device after usage refreshes; iOS controls background checks
- Known provider reset times can notify while the app is closed

YOUR DATA STAYS YOURS
Model Pulse has no accounts, no analytics, and no tracking. Keys live in
the iOS Keychain. Requests go straight from your device to the providers
you connect — there is no Model Pulse server.

Model Pulse is an independent tracker and is not affiliated with or endorsed
by OpenAI, Anthropic, Google, or any other listed provider.

## Keywords (100 char max, comma-separated)
ai,usage tracker,rate limits,api spend,openai,anthropic,claude,kimi,widget,tokens,codex

(Note: "chatgpt" was dropped — third-party trademarks in the hidden keywords
field are a 5.2.1 rejection risk. Descriptive mentions stay in the
description, which is standard compatibility language.)

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
- Data collection: Update this questionnaire to match the implemented
  provider connections. Model Pulse stores credentials and usage telemetry
  locally and, only after in-app permission, sends credentials and
  account-telemetry requests directly from the device to the provider the user
  chooses. Do not submit the prior **Data Not Collected** answer without
  confirming that it accurately reflects Apple's current questionnaire for
  these direct provider transmissions.
- Encryption: exempt (ITSAppUsesNonExemptEncryption = false, already in the
  binary — answer "No" to non-exempt encryption if asked).

## Review notes for Apple (suggestion)
Model Pulse displays usage, rate-limit, and spend data for third-party AI
providers that the user already has accounts with. No sign-in or account is
required to review the app: on first launch, the app presents an in-app
provider-data disclosure before any provider request can occur. It identifies
the data sent (the API/admin key or OAuth credential the user chooses, plus
the account-telemetry request), the possible recipients (OpenAI/ChatGPT,
Anthropic/Claude, Moonshot/Kimi, MiniMax, Z.ai, Google/Gemini, ElevenLabs,
Poe, Codebuff, GitHub/Copilot, Chutes, Factory, OpenCode, OpenRouter, and
fal.ai), and the
purpose. The user must affirmatively choose "Allow provider data sharing"
before a provider connection, manual refresh, automatic refresh, background
task, or widget sync can send provider data.

The user can decline and still review all non-connected app screens. In
Settings, "Stop & remove access" withdraws permission, stops future provider
requests, and removes stored provider API keys, admin keys, OAuth tokens, and
cached provider usage from the device. The privacy policy contains the same
data collection, use, recipient, storage, and deletion details.

The app offers optional local notifications ("Usage alerts" in Settings).
Notification permission is requested only when the user turns that toggle on
— never at launch. The Background Processing mode is used solely to
periodically refresh usage numbers so those threshold alerts can fire while
the app is closed. No data leaves the device except the direct provider
requests the user has specifically approved.

Subscriptions are the user's own existing provider subscriptions; the app
sells nothing and contains no in-app purchases.
