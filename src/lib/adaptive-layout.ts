/** Keep phone-sized cards readable; larger text requests fewer columns. */
export function getCardGridLayout(width: number, fontScale = 1, minimumWidth = 260) {
  const gap = 16;
  const minimumCardWidth = minimumWidth * Math.max(1, fontScale);
  const columns = Math.min(3, Math.max(1, Math.floor((width + gap) / (minimumCardWidth + gap))));
  return {
    columns,
    gap,
    cardWidth: width > 0 ? (width - gap * (columns - 1)) / columns : "100%" as const,
  };
}

/** iPad windows need enough room for both navigation and readable forms. */
export function getDashboardLayout(availableWidth: number, fontScale = 1, tablet = false) {
  const scale = Math.max(1, fontScale);
  const sidebarWidth = tablet ? Math.min(400, Math.max(320, availableWidth * 0.3)) : 352;
  return {
    canSplit: availableWidth >= (tablet ? 960 : 820) * scale,
    sidebarWidth,
    gutter: tablet && availableWidth >= 600 ? 24 : 16,
    minimumCardWidth: tablet ? 320 : 260,
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
