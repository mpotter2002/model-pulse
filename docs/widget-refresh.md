# Widget refresh behavior

The widget previously selected API metrics and bars when subscription data was unavailable, despite the selected subscription mode. Failed saved-settings reads also returned defaults, including API mode, and overlapping syncs could publish old results after newer ones.

The fix keeps subscription and API modes separate. In subscription mode, unavailable usage produces a refresh placeholder rather than an API budget. Expired/error connections can retain persisted subscription limits and show a cached-data indicator; explicitly disconnected accounts do not reuse their saved usage. Older persisted usage is marked cached. API mode similarly does not fall back to subscription windows.

Widget publication now checks current saved settings both before gathering data and immediately before updating the timeline. Strict read errors preserve the existing timeline. Newer syncs supersede slower older ones. Background state reads use the same strict mode rather than publishing defaults on a temporary Keychain failure.

Widget sync renders cached provider results without starting duplicate network requests. The foreground store republishes after subscription refresh completes. Background alert evaluation runs before widget publication, so widget work cannot delay alerts after the usage checks have completed. Notification evaluation also uses strict settings reads, preserving pending reset reminders when preferences temporarily cannot be read.

Validation: `npm run typecheck`, `node tests/notifications.cjs`, and `node tests/widget-sync.cjs`. The regression harnesses mock native APIs; they do not establish on-device background scheduling or widget rendering.

On-device validation: choose subscription mode and confirm its rate-limit bars. Leave the app closed long enough for a background refresh or token expiry, then verify it stays in subscription mode. In a development build, simulate unavailable provider data and unreadable settings to confirm API bars do not replace subscription bars. Confirm cached labels fit small, medium and large widgets. Change modes during a refresh and confirm the latest saved choice wins. Continue testing reset notification delivery with the phone locked; usage-threshold delivery still depends on iOS background execution.
