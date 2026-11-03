# Notification delivery

## What changed

Background usage refresh already existed, using Expo BackgroundTask with a 60-minute minimum interval. The latest local changes re-register it with a 15-minute minimum interval hint. Threshold and reset notifications used immediate triggers, so a reset could only notify after a refresh discovered it.

Two independent delivery problems are addressed:

- SecureStore defaults to `WHEN_UNLOCKED`. Background work on a locked iPhone could not read provider-data consent, saved API keys/OAuth tokens, preferences or alert dedupe state. These records now use an iOS Keychain service with `AFTER_FIRST_UNLOCK`. They remain protected until the user unlocks the device once after reboot. Existing records migrate during successful reads, and legacy copies are removed only after a successful write. A new service is necessary because this version of Expo SecureStore updates an existing item's value without changing its accessibility.
- Providers with exact reset timestamps now retain those timestamps separately from their rounded display hints. When a window has crossed a selected alert threshold, its reset reminder is handed to iOS as a date trigger. A known scheduled reset can notify without another app/background refresh. It is described as the provider's scheduled reset time, rather than claiming freshly verified available quota.

Reset reminders are reconciled without duplicating unchanged requests. Disabling alerts/reset alerts/subscription alerts, revoking data-sharing consent, or disconnecting a provider cancels applicable pending reminders. Unavailable providers keep previously scheduled reminders. Expired cached windows do not produce late threshold notifications. Providers without exact timestamps retain the refresh-based reset detection; rounded text is never used to guess a schedule.

Startup/preference reconciliation now schedules known reset reminders without emitting threshold alerts from cached usage. Rate-limited/failed subscription snapshots cannot emit newly crossed threshold notifications. Unreadable or malformed dedupe history fails the evaluation rather than assuming no alerts have been sent and sending them all again.

API and subscription background checks start together. Each provider evaluates alerts as soon as its check finishes; a slow API report no longer holds every subscription alert behind it. Settings includes background-only start/completion timestamps, outcome and provider/alert counts. This history records no credentials or provider response bodies and does not count foreground launches as background execution.

Concurrent alert evaluations are serialized, and threshold dedupe is committed after successful scheduling so failed deliveries can retry. Existing dedupe state migrates when a metric gains an exact reset timestamp.

## Remaining delivery limits

Usage-percentage and API-budget alerts still require a fresh provider usage check. iOS chooses when BackgroundTask runs and may delay or skip it, especially with background execution restrictions. Force-quitting the app stops its background work until reopening. A shorter minimum interval does not guarantee a timely check. Scheduled local reset reminders do not depend on background JavaScript, though notification permission, Focus and Scheduled Summary can affect their presentation.

Timelier threshold alerts while the app is closed would require provider events or a server that can check usage and send visible remote pushes. The current app has no Model Pulse server, and credentials stay on-device. Server monitoring would require a separate architecture and explicit decisions about credential storage, provider access, consent, privacy disclosures and operating costs. No such backend was added.

## Verification

Run `npm run typecheck`, `node tests/notifications.cjs`, and `node tests/background-alerts.cjs`. The regression harness checks migration to the separate Keychain service, write ordering, legacy dedupe, timed reset scheduling, concurrent evaluations, failed threshold retries, cancellation and expired windows. The iOS production JavaScript bundle also exported successfully. Native APIs are mocked in the regression harness, so these checks do not establish real-device delivery.

Before releasing, use a development/release build on a physical iPhone:

1. Upgrade an existing install and open it while unlocked. Confirm saved connections and settings remain intact. Enable alerts and ensure provider data sharing is allowed.
2. Refresh a connected provider that supplies an exact reset timestamp and is above a selected threshold. Confirm one date-trigger reminder is pending for that window. Refresh again and confirm no duplicate.
3. Leave the app in the background and lock the phone through the reset time. Confirm delivery without reopening. Repeat with the app force-closed to distinguish local date-trigger delivery from background usage polling. Use a short test fixture in a development build if no natural reset is near; do not ship fixture notifications.
4. Disable reset alerts, disable all alerts, disconnect the provider and revoke provider data sharing in separate runs. Confirm each removes applicable pending reminders.
5. Trigger background work using Expo's development-only BackgroundTask testing API on-device while locked, and confirm stored consent/credentials/preferences are readable after the first unlock. Confirm the app does not fetch provider data after consent is revoked.
6. Confirm expected behavior when notifications are disabled and when a provider fetch fails. Check Focus/Scheduled Summary when assessing banner timing.

Build 47 was tested by the user and still delivered usage alerts on opening the app. The locked-Keychain fix and local reset scheduling did not meet the timely-threshold requirement. The user chose to keep credentials on-device and declined server monitoring. The newer local changes remain best-effort improvements, not a solution for guaranteed closed-app percentage alerts. The user subsequently authorized TestFlight 1.0.4 (48) to test these best-effort changes.

This work changes source only. A new distributed app build is needed for users to receive it.

References: [Expo SDK 56 notifications](https://docs.expo.dev/versions/v56.0.0/sdk/notifications/), [BackgroundTask](https://docs.expo.dev/versions/v56.0.0/sdk/background-task/), [SecureStore](https://docs.expo.dev/versions/v56.0.0/sdk/securestore/).
