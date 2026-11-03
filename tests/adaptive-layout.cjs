const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('src/lib/adaptive-layout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(code, { exports: moduleContext.exports });
const { getCardGridLayout, getMasonryLayout, getDashboardLayout } = moduleContext.exports;

// iPad mini through 13-inch Pro, including Split View and Stage Manager windows.
for (const width of [320, 375, 507, 600, 744, 768, 810, 820, 834, 960, 1024, 1032, 1133, 1180, 1194, 1366, 1376]) {
  for (const scale of [1, 1.3, 2]) {
    const dashboard = getDashboardLayout(width, scale, true);
    const contentWidth = width - dashboard.gutter * 2;
    const grid = getCardGridLayout(contentWidth, scale, dashboard.minimumCardWidth);
    assert.ok(Math.abs(grid.cardWidth * grid.columns + grid.gap * (grid.columns - 1) - contentWidth) < 0.001);
    if (dashboard.canSplit) {
      assert.ok(dashboard.sidebarWidth >= 320 && dashboard.sidebarWidth <= 400);
      assert.ok(width - dashboard.sidebarWidth - dashboard.gutter * 2 >= 560,
        'split detail forms retain a usable minimum width');
    }
  }
}
assert.equal(getDashboardLayout(820, 1, true).canSplit, false, '11-inch portrait avoids cramped side-by-side forms');
assert.equal(getDashboardLayout(1180, 1, true).canSplit, true, '11-inch landscape supports a sidebar');
assert.equal(getCardGridLayout(1032 - 48, 1, 320).columns, 2, '13-inch portrait keeps roomy cards');
assert.equal(getCardGridLayout(1376 - 48, 1, 320).columns, 3, '13-inch landscape grid uses three columns');
assert.equal(getDashboardLayout(840).canSplit, true, 'Duo split threshold is preserved');

// Available content widths, after safe-area insets and screen padding.
assert.equal(getCardGridLayout(398).columns, 1, 'portrait iPhone stays single-column');
assert.equal(getCardGridLayout(580).columns, 2, 'open portrait uses two columns');
assert.equal(getCardGridLayout(840).columns, 3, 'wide landscape can show three columns');
assert.equal(getCardGridLayout(840, 1.6).columns, 1, 'large type takes priority over column count');
for (const width of [240, 320, 398, 519, 536, 580, 799, 812, 840, 1200, 1600]) {
  for (const scale of [1, 1.3, 2, 3]) {
    const { columns, cardWidth, gap } = getCardGridLayout(width, scale);
    assert.ok(columns >= 1 && columns <= 3);
    assert.ok(cardWidth > 0);
    assert.ok(Math.abs(cardWidth * columns + gap * (columns - 1) - width) < 0.001,
      'cards and gutters fit their measured container without horizontal overflow');
  }
}
assert.equal(getCardGridLayout(0).cardWidth, '100%', 'first render remains visible before measurement');
// Unequal cards must leave only a gutter, rather than wait for the tallest row.
const portrait = getMasonryLayout([200, 260, 290, 380, 310], 2, 16);
assert.equal(portrait.positions[2].column, 0);
assert.equal(portrait.positions[2].top, 216, 'next card fills space under the shorter card');
assert.equal(portrait.positions[4].top, 522);
for (const columns of [1, 2, 3]) {
  for (const heights of [[200, 260, 290, 380, 310], [400, 260, 290, 180, 310], []]) {
    const layout = getMasonryLayout(heights, columns, 16);
    let bottom = 0;
    for (let column = 0; column < columns; column++) {
      let nextTop = 0;
      layout.positions.forEach((position, index) => {
        if (position.column !== column) return;
        assert.equal(position.top, nextTop, 'each column has a consistent gutter without row gaps');
        bottom = Math.max(bottom, position.top + heights[index]);
        nextTop = position.top + heights[index] + 16;
      });
    }
    assert.equal(layout.height, bottom, 'scroll content includes the bottom of every card');
  }
}
console.log('Adaptive layout checks passed (phone, portrait, landscape, large type, exact container fit).');
