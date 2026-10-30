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

/** Pack cards into the shortest column, preserving source/reading order. */
export function getMasonryLayout(heights: number[], columns: number, gap: number) {
  const bottoms = Array<number>(Math.max(1, columns)).fill(0);
  const positions = heights.map((height) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const top = bottoms[column];
    bottoms[column] = top + height + gap;
    return { column, top };
  });
  return { positions, height: Math.max(0, ...bottoms) - (heights.length ? gap : 0) };
}
