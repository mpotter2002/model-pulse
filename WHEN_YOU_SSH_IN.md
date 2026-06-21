# When you SSH into the Mac

Run this exact command:

```bash
cd /Users/michaelpotter/AIProjects/projects/ai-subscriptions-widget
npx eas-cli build --platform ios --profile preview
```

You're already logged in to EAS as `mpotter2002` so it skips that.

Expected prompts and answers:

1. **"Would you like to set up a development build for the SignalStackWidget extension target?"**
   - Answer: defaults are fine, press Enter

2. **"Do you want EAS CLI to log in to your Apple Developer account?"**
   - Answer: `y`

3. **Apple ID prompt** — type your Apple ID email, press Enter

4. **Apple password prompt** — type password, press Enter

5. **2FA / SMS code prompt** — enter the 6-digit code from your phone

6. **"Reuse this Apple Team?"** if you have multiple, pick the right one (Personal Team or your org)

7. **"Generate a new Apple Distribution Certificate?"**
   - Answer: `y` (EAS will create one and store it on the Expo server)

8. **"Generate a new provisioning profile for com.michaelpotter.signalstack?"**
   - Answer: `y`

9. **Same prompt for `com.michaelpotter.signalstack.ExpoWidgetsTarget`**
   - Answer: `y`

10. **App Store Connect registration** — EAS will offer to register the bundle ID; say `y`

11. **Build queues** — you'll see a URL like `https://expo.dev/accounts/mpotter2002/projects/ai-subscriptions-widget/builds/<id>`

After ~15–25 minutes the build finishes. Then on your phone:

- Open `https://expo.dev/accounts/mpotter2002/projects/ai-subscriptions-widget/builds`
- Tap the latest build
- Tap "Install" or scan the QR code
- iOS will prompt to install the ad-hoc provisioning profile; allow it
- App appears on Home Screen

If you hit anything unexpected, copy the error and paste it into Codex — I'll debug from there.
