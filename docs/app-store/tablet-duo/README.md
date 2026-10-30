# iPad and Duo screenshot assets

## Ready: iPad 13-inch

Upload `exports/*.png` to App Store Connect → app → iOS version 1.0.4 → Previews and Screenshots → iPad → 13-inch display. The four numbered files are 2064 × 2752, RGB PNG, with no alpha. All use a portrait upload canvas; panels 2 and 3 show landscape app captures within it. Use the numbered order. These supplement the existing iPhone set.

The app images are real captures from the cloud-built simulator app at source `0613dd4`, matching production 1.0.4 (53). No accounts or credentials are connected. Provider summaries and widget preview placeholders are shown exactly as rendered by the app. Marketing copy and frames are HTML, not generated app UI.

`captures/` contains original native-resolution captures. `panel-1.html` through `panel-4.html` plus `panel.css` are the authoring sources and use the existing `../shots/fonts.css`. Serve `docs/app-store` on 127.0.0.1 and render each page at viewport 2064 × 2752 with device scale 1 after fonts/images load. The frame preserves the capture aspect ratio.

## Pending: Duo

Earlier user captures IMG_8551–IMG_8557 are no longer present at their Downloads paths. This machine's installed simulator runtime cannot boot the Duo device type. Fresh captures from build 53 are needed to finish accurate Duo marketing panels: folded front home, open portrait grid, open landscape grid, and open landscape list/detail. Hide private account details before sharing.

Apple's screenshot specifications list inner-display canvases 2007 × 2853 / 2853 × 2007 and outer-display canvases 1398 × 2034 / 2034 × 1398. Preserve each capture's aspect ratio in its corresponding frame; do not stretch an iPad capture into a Duo screen.

Specs: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
