/** Keep phone-sized cards readable; larger text requests fewer columns. */
export function getCardGridLayout(width: number, fontScale = 1) {
  const gap = 16;
  const minimumCardWidth = 260 * Math.max(1, fontScale);
  const columns = Math.min(3, Math.max(1, Math.floor((width + gap) / (minimumCardWidth + gap))));
  return {
    columns,
    gap,
    cardWidth: width > 0 ? (width - gap * (columns - 1)) / columns : "100%" as const,
  };
}
