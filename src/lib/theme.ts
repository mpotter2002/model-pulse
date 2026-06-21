// Proper React Native shadow props (boxShadow is web-only)
export function shadowProps(color: string, opacity = 0.08) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: opacity,
    shadowRadius: 12,
    elevation: 4,
  };
}
