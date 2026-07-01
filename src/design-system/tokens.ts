// SignalStack design tokens — semantic, shadcn-inspired color system for React Native.

export type ThemeMode = "light" | "dark";

export interface ThemeTokens {
  // Background
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;

  // Actions
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;

  // Status
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;

  // Legacy glass tokens (kept for compatibility during migration)
  glassFill: string;
  glassStroke: string;
  glassHairline: string;
  glassTint: "light" | "dark" | "default";
  blurTint: "light" | "dark" | "default";
  statusBar: "light" | "dark" | "auto";

  // Legacy aliases
  backgroundElevated: string;
  panel: string;
  subtlePanel: string;
  chip: string;
  text: string;
  action: string;
}

export const tokens = {
  light: {
    background: "#E8EAED",
    foreground: "#101112",
    card: "#FCFCFC",
    cardForeground: "#101112",
    muted: "#F1F1F1",
    mutedForeground: "#6B7077",
    border: "#D5D8DD",
    input: "#D5D8DD",
    ring: "#101112",

    primary: "#101112",
    primaryForeground: "#F1F1F1",
    secondary: "#FFFFFF",
    secondaryForeground: "#101112",
    accent: "#2563EB",
    accentForeground: "#F1F1F1",
    destructive: "#EF4444",
    destructiveForeground: "#F1F1F1",

    success: "#4CC96C",
    successForeground: "#101112",
    warning: "#FF7A1A",
    warningForeground: "#101112",

    // Legacy
    glassFill: "rgba(255,255,255,0.5)",
    glassStroke: "rgba(255,255,255,0.72)",
    glassHairline: "rgba(16,17,18,0.08)",
    glassTint: "light" as const,
    blurTint: "light" as const,
    statusBar: "dark" as const,

    backgroundElevated: "#FCFCFC",
    panel: "#FCFCFC",
    subtlePanel: "#F1F1F1",
    chip: "#F1F1F1",
    text: "#101112",
    action: "#101112",
  } satisfies ThemeTokens,

  dark: {
    background: "#0A0A0B",
    foreground: "#F1F1F1",
    card: "#141517",
    cardForeground: "#F1F1F1",
    muted: "#1B1D1F",
    mutedForeground: "#8E939A",
    border: "#2A2B2E",
    input: "#2A2B2E",
    ring: "#F1F1F1",

    primary: "#F1F1F1",
    primaryForeground: "#101112",
    secondary: "#1B1D1F",
    secondaryForeground: "#F1F1F1",
    accent: "#3B82F6",
    accentForeground: "#F1F1F1",
    destructive: "#EF4444",
    destructiveForeground: "#F1F1F1",

    success: "#55D46E",
    successForeground: "#101112",
    warning: "#FF7A1A",
    warningForeground: "#101112",

    // Legacy
    glassFill: "rgba(27,29,31,0.64)",
    glassStroke: "rgba(255,255,255,0.1)",
    glassHairline: "rgba(255,255,255,0.05)",
    glassTint: "dark" as const,
    blurTint: "dark" as const,
    statusBar: "light" as const,

    backgroundElevated: "#141517",
    panel: "#141517",
    subtlePanel: "#1B1D1F",
    chip: "#1B1D1F",
    text: "#F1F1F1",
    action: "#F1F1F1",
  } satisfies ThemeTokens,
};

// Typography scale
export const typography = {
  xs: { fontSize: 11, lineHeight: 14, letterSpacing: 0.32 },
  sm: { fontSize: 12, lineHeight: 16, letterSpacing: 0.28 },
  base: { fontSize: 14, lineHeight: 20, letterSpacing: 0.08 },
  lg: { fontSize: 16, lineHeight: 22, letterSpacing: -0.12 },
  xl: { fontSize: 19, lineHeight: 26, letterSpacing: -0.28 },
  "2xl": { fontSize: 24, lineHeight: 31, letterSpacing: -0.6 },
  "3xl": { fontSize: 32, lineHeight: 38, letterSpacing: -1.1 },
} as const;

export type TextSize = keyof typeof typography;

export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

export const fontFamily = {
  sans: {
    normal: "SpaceGrotesk_400Regular",
    medium: "SpaceGrotesk_500Medium",
    semibold: "SpaceGrotesk_600SemiBold",
    bold: "SpaceGrotesk_700Bold",
    extrabold: "SpaceGrotesk_700Bold",
  },
  mono: {
    normal: "SpaceMono_400Regular",
    medium: "SpaceMono_400Regular",
    semibold: "SpaceMono_700Bold",
    bold: "SpaceMono_700Bold",
    extrabold: "SpaceMono_700Bold",
  },
} as const;

// Spacing scale
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export type Space = keyof typeof spacing;

// Radius scale
export const radius = {
  none: 0,
  sm: 8,
  md: 10,
  lg: 10,
  xl: 14,
  "2xl": 22,
  full: 9999,
} as const;

export type Radius = keyof typeof radius;

// Shadows
export const shadow = {
  sm: { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  lg: { shadowColor: "#000000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 6 },
} as const;

export type Shadow = keyof typeof shadow;
