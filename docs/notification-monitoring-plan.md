# Closed-app notification investigation

Build 47 retains on-device periodic background checks. A user on build 47 reports usage alerts arriving together when opening Model Pulse and no Claude limit alert while the app was closed. This confirms the previous change did not meet the timely-threshold requirement. It does not establish whether iOS skipped the task, a provider fetch failed/throttled, or a notification was deferred by iOS presentation settings; device diagnostics are needed to distinguish those.

## Delivery requirements

Percentage and budget alerts require a new usage observation. A reset timestamp can be scheduled locally, but the time when future usage crosses a threshold cannot be predicted reliably. Changing the background minimum interval or scheduling speculative percentage alerts cannot satisfy this requirement. A provider webhook, supported event source, or a continuously running monitoring service must observe usage independently of the iPhone.

## Proposed optional monitoring (declined for this update)

- Separate in-app opt-in, per connected provider. Existing installations remain device-only unless the user enables monitoring.
- Server stores encrypted provider credentials, notification thresholds, a push destination, dedupe state and minimum usage metadata. No prompts or model responses are sent to it.
- Authenticate device registration and every configuration/deletion request. Tokens and API keys must never appear in logs. Use managed secret storage, encryption with rotation, and authenticated encryption for credentials.
- A scheduled worker checks provider usage at the provider's permitted interval, respects retry-after/cooldowns, and retains a timestamp for the last successful check. Failed/cached usage never counts as a new threshold crossing.
- Emit a visible remote push on a new crossing, deduped by provider, quota window and threshold. Send only the highest crossed threshold when a check spans several. Remote pushes must not rely on a silent push waking the app.
- Reset reminders must have a single owner per provider to avoid duplicate local and remote reset alerts. Moving to monitoring cancels the corresponding local reminders; disabling monitoring reconciles local ones from the latest usage.
- Disconnecting a provider, withdrawing consent, or disabling monitoring removes the server credential and scheduled checks. Deletion must be authenticated and confirmed, with a retryable pending deletion state when offline.
- Refresh-token ownership must be settled before monitoring: the phone and server must not independently rotate the same provider refresh token. Use one owner or a provider-approved separate grant.
- Confirm every provider permits the planned service-side access. Claude usage already has significant minimum intervals and throttling; do not bypass those controls. Backend polling gives interval-based detection, not instantaneous or guaranteed notifications. APNs/Expo delivery, offline devices and Focus can still delay presentation.

## Decisions before activation

Choose whether to change the current device-only privacy model, the hosting/runtime and its cost envelope, provider credential ownership, and initially supported providers. Update the in-app disclosure, published privacy policy and App Store privacy responses before activating server-side credential collection. No credentials have been transferred and no service has been deployed.

## User decision

The user declined a hosted credential-monitoring service because of operating costs and credential security responsibility. Keep all credentials on-device. No server monitoring or remote credential collection is being implemented. Improve local best-effort checks and make their limitations visible; do not call timely closed-app threshold delivery solved.

## Current release state

Build 47 and its upload completed. No cache-feature build has been started. The user subsequently authorized TestFlight 1.0.4 (48), including the cache breakdown and best-effort on-device notification changes. Its build and automatic submission have been scheduled.
