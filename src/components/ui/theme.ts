import { useAppStore } from "@/store/app-store";
import { tokens, type ThemeTokens, type ThemeMode } from "@/design-system/tokens";

export function useTheme() {
  return useAppStore().theme;
}

export { tokens, type ThemeTokens, type ThemeMode };
