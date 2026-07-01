import type { ModelCardId } from "@/types/domain";

// Provider logos from the MIT-licensed thesvg library (github.com/GLINCKER/thesvg).
// Brand marks are trademarks of their owners, used here for identification only.
//
// `tint: "foreground"` logos are single-color brand glyphs; we render them in the
// theme's foreground color so they adapt to light/dark (black on light, white on
// dark) — matching how each brand ships separate light/dark marks.
// `tint: "none"` logos keep their own brand colors (they read well on both
// backgrounds) and are rendered untinted.
export type ProviderLogoTint = "foreground" | "none";
export type ProviderLogo = { source: number; tint: ProviderLogoTint; sourceLight?: number };

export const PROVIDER_LOGOS: Partial<Record<ModelCardId, ProviderLogo>> = {
  // Monochrome brand glyphs -> follow the theme foreground.
  openai: { source: require("../../assets/logos/openai.svg"), tint: "foreground" },
  copilot: { source: require("../../assets/logos/copilot.svg"), tint: "foreground" },
  elevenlabs: { source: require("../../assets/logos/elevenlabs.svg"), tint: "foreground" },
  // Two-color mark: brand-blue dot stays, but the "K" must flip black/white per
  // theme. expo-image tintColor can't recolor a single path, so ship a dark
  // (white K) + light (black K) asset and pick by theme in the renderer.
  kimi: {
    source: require("../../assets/logos/kimi.svg"),
    sourceLight: require("../../assets/logos/kimi-light.svg"),
    tint: "none",
  },
  zai: { source: require("../../assets/logos/zai.svg"), tint: "foreground" },
  // Brand-colored glyphs that read on both light and dark -> untinted.
  anthropic: { source: require("../../assets/logos/anthropic.svg"), tint: "none" },
  gemini: { source: require("../../assets/logos/gemini.svg"), tint: "none" },
  minimax: { source: require("../../assets/logos/minimax.svg"), tint: "none" },
  poe: { source: require("../../assets/logos/poe.svg"), tint: "none" },
  // codebuff, chutes, factory: no logo in the library yet -> initials fallback.
};

export function getProviderLogo(id: ModelCardId): ProviderLogo | undefined {
  return PROVIDER_LOGOS[id];
}
