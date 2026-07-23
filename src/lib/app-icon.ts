import { Appearance, Platform } from "react-native";

import type { AppIconMode } from "@/types/domain";

// Alternate icon names must match the plugin config in app.json
// (expo-alternate-app-icons).
const ICON_NAME_BY_MODE: Record<Exclude<AppIconMode, "system">, string> = {
  light: "LightIcon",
  dark: "DarkIcon",
};

/**
 * Resolve the concrete alternate-icon name for a given mode. For "system" we
 * explicitly pick the light/dark alternate based on the current appearance,
 * because iOS does NOT reliably auto-switch the primary icon's light/dark
 * variant once an app ships alternate icons.
 */
function resolveIconName(mode: AppIconMode): string {
  if (mode === "system") {
    return Appearance.getColorScheme() === "dark" ? ICON_NAME_BY_MODE.dark : ICON_NAME_BY_MODE.light;
  }
  return ICON_NAME_BY_MODE[mode];
}

/**
 * Apply the user's chosen app-icon mode. "system" resets to the default icon
 * (which switches light/dark with the phone); "light"/"dark" force a fixed
 * variant regardless of the system appearance. iOS only; a no-op elsewhere or
 * when the device doesn't support alternate icons.
 */
export async function applyAppIconMode(mode: AppIconMode): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const { supportsAlternateIcons, setAlternateAppIcon, getAppIconName } = await import(
      "expo-alternate-app-icons"
    );
    if (!supportsAlternateIcons) return;
    const target = resolveIconName(mode);
    // Avoid the iOS "you have changed the app icon" alert when nothing changed.
    if (getAppIconName() === target) return;
    await setAlternateAppIcon(target as never);
  } catch (error) {
    console.warn("[ModelPulse] failed to apply app icon", error);
  }
}
