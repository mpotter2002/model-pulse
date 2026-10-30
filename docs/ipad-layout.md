# iPad layout for 1.0.4

This uses the iPad device family and current window size, not a model-name list.
It covers iPad mini, standard iPad, Air and Pro, including resized multitasking
windows. No Expo or iOS deployment-target upgrade is introduced.

- Portrait starts with a grid. Cards have a 320-point preferred minimum width,
  scaled with accessibility text, and use the existing measured masonry packing.
  Typical mini/11/13-inch portrait windows show two roomy columns.
- Landscape starts with a model sidebar and independently scrolling detail when
  at least 960 points (scaled for text) are available. The sidebar grows from
  320 to 400 points and uses compact model rows, rather than full usage cards.
  Grid remains available and shows up to three columns on wider windows.
- Narrow windows collapse to the compact flow. Switching between grid and detail
  by rotation keeps the selected detail panel mounted, preserving form drafts.
  Choosing Grid explicitly returns to the overview.
- The split detail has a maximum reading width of 840 points. Shared scroll
  screens now measure their own pane width for centering, rather than assuming
  the full device width. All settings/detail routes keep readable form widths.
- Settings and widget settings use measured navigation-header height for their
  top padding. Home adds 24-point gutters on larger iPad windows.
- The approved phone/Duo column minimum and split threshold remain unchanged.

Validation: TypeScript and adaptive-layout checks cover 320–1376 point windows,
mini/11/13-inch full screens, large text, column fit, and minimum detail width.
Native iOS 26.5 simulator checks on the 13-inch iPad Pro passed: launch, portrait grid, routed provider detail and back, automatic landscape split, provider selection, explicit grid retained across rotation, settings, and widget previews. Empty credential forms correctly disable Save. The simulator touch runner misplaces some landscape taps after rotation, so resulting screens were verified with screenshots and accessibility snapshots. Physical mini/11/13-inch devices, resized multitasking windows, keyboard interaction, and live account connections still need device checks.

The `screenshots` EAS profile produces an embedded-JS simulator app without
incrementing the store build number, avoiding a heavy native build on the laptop.
App Store screenshots must use real app captures. Framing and marketing copy may
surround those captures; phone screenshots must not be stretched into an iPad UI.

Release: EAS production build `bba3ecfa-9a64-4437-8966-ed8354cef96c`, source `0613dd4`, is **1.0.4 (53)**. Apple reports `VALID` and `IN_BETA_TESTING`. Both app and widget archive versions were verified. Public App Store review has not been submitted.
