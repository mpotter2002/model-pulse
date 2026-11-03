# App Review Response: 5.1.1(i) and 5.1.2(i)

Hello App Review,

Thank you for the clarification. We revised Model Pulse to add an in-app
provider-data permission flow before any provider request is sent.

On first launch, and again from Settings before a user can connect a provider,
the app clearly explains:

- The data sent: the API key, admin key, OAuth access token, OAuth refresh
  token, or authorization code the user chooses, plus the request needed to
  retrieve account usage telemetry.
- The recipients: OpenAI/ChatGPT, Anthropic/Claude, Moonshot/Kimi, MiniMax,
  Z.ai, Google/Gemini, ElevenLabs, Poe, Codebuff, GitHub/Copilot, Chutes,
  Factory, OpenCode, OpenRouter, and fal.ai, depending on the provider the
  user chooses.
- The use: retrieving the user's plan, usage and quota windows, reset times,
  token/request totals, balance, organization spend, and rate-limit data for
  display in the app and widget and, if enabled, local alerts.

The user must tap **Allow provider data sharing** before the app can initiate
a provider OAuth flow, save a provider credential, manually refresh, perform
automatic refreshes, run background refreshes, or sync the widget. The user
can decline and use the app's non-connected screens. In Settings, **Stop &
remove access** withdraws permission, stops future provider requests, and
removes saved provider API keys, admin keys, OAuth tokens, and cached usage
from the device.

We also updated the privacy policy to describe the data collected, local
storage, direct provider recipients, uses, and deletion controls.

Model Pulse has no developer-operated server, analytics, advertising, or
tracking. It does not send chat prompts, chat responses, files, contacts, or
data to a Model Pulse server.

Thank you for reviewing the updated build.
