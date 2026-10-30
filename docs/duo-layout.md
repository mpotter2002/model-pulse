# Duo first pass

The wide dashboard defaults to a model list beside the selected model's detail
panel. A Grid control switches to a full-width overview with up to three columns.
Compact windows show the existing single-column phone flow; medium windows can
show two grid columns. Cards pack into the shortest available column with a
consistent 16-point gutter, using measured heights so subscription updates and
wrapped text do not leave row-sized gaps. Keyed cards stay mounted during reflow.
Open landscape adds safe-area padding plus 24 points above/left of the overview
and 32 points above the selected detail card. The home overview also has a
24-point top gutter on compact/portrait windows. Routed model/provider details
use the actual navigation header height plus 16 points instead of a fixed
96-point spacer, so a side-mounted back button does not leave a large top gap.
Layout decisions use the current window/container size,
safe-area insets, and text scale, rather than a device-name check.

Selecting a model in the wide list updates its detail pane. Folding or narrowing
the window keeps that selected panel and its input state; All models returns to
the overview. Each pane scrolls independently. Increasing system text size reduces
the column count and eventually collapses list/detail into the compact flow.

The app background fills the window; safe-area padding protects controls on all
four edges. Details, settings, and widget settings retain a readable maximum
content width, with the background continuing to the edges. Widgets keep their
existing system-family sizing and rendering code.

## Native requirements

Apple's [Duo preparation guide](https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo)
requires a current Xcode build to use the status/camera area. Xcode 27 also
requires scene lifecycle support. This project remains on Expo SDK 56:

- `with-ios-scene.js` creates a scene-owned window and forwards URL, universal
  link, and foreground/background callbacks to the existing Expo app delegate.
  Only one application scene is enabled. The generated native directory is ignored
  by Git, so the plugin is the source of truth for local and EAS prebuilds.
- The production EAS profile pins Xcode 27.1. The previous automatic SDK 56 image
  uses an older Xcode and cannot fix the status-area boundary.
- The postinstall script applies a narrow Swift compatibility fix to SDK 56's
  `expo-modules-jsi`: it passes direct setter function references to C++ instead
  of converting a function in a ternary expression. Nil setters remain nil.
  It is idempotent and fails explicitly if the expected SDK 56 source changes.
  Remove this workaround and reassess the scene plugin when upgrading Expo.
- The EAS post-install hook prepares the JSI device framework after CocoaPods and
  before archiving. This avoids Xcode 27 treating a nested SPM build's spurious
  "failed with exit code 0" diagnostic as an archive failure. Nonzero compiler
  exits still stop the build; Expo's own build phase verifies the cached slice.

App version stays 1.0.4 for the release being prepared; EAS manages and increments the build number. Uploads are for
TestFlight only. Public App Store review waits for Michael's device-test approval.

## Validation

`npm run typecheck` checks the TypeScript app. `node tests/adaptive-layout.cjs`
covers the compact, medium, wide, and large-text grids and verifies container fit.
The existing input-cache, notification, background-alert, and widget-sync checks
cover the inherited changes included with Michael's approval.

The provided screenshots measure 1371 × 2034 (outer), 2853 × 2007 (inner landscape),
and 2007 × 2853 (inner portrait). These are screenshot pixels, not React Native
layout points; they informed proposal proportions, not hardcoded app breakpoints.
A local Xcode 27.1 native debug build passed, including the scene delegate and
widget extension. Simulator installation/launch timed out on the resource-limited
laptop, so no reliable runtime screenshots or interaction checks were obtained.
The installed runtime cannot run the available Duo device type. Michael must
confirm the real Duo's background/status area, fold transition, and both inner
orientations, plus the iPhone 17 Pro Max and small/medium/large Home Screen widgets.
