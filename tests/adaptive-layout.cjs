const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('src/lib/adaptive-layout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(code, { exports: moduleContext.exports });
const { getCardGridLayout } = moduleContext.exports;

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
console.log('Adaptive layout checks passed (phone, portrait, landscape, large type, exact container fit).');
