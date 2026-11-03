const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const modules = new Map();
const mocks = {
  'expo-crypto': {},
  '@/lib/provider-data-sharing': { isProviderDataSharingAllowed: async () => true },
  '@/lib/providers': { demoSnapshot: () => ({ mode: 'demo', usage: {} }) },
};
function load(name) {
  if (mocks[name]) return mocks[name];
  if (modules.has(name)) return modules.get(name).exports;
  const file = path.resolve(__dirname, '../src', name.slice(2) + '.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; modules.set(name, module);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(load, module, module.exports);
  return module.exports;
}
const { inputCacheUsage } = load('@/lib/input-cache');
const anthropicRow = { uncached_input_tokens: 1500, cache_read_input_tokens: 200, cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 }, output_tokens: 500 };
let c = inputCacheUsage('anthropic', [anthropicRow]);
assert.equal(c.freshInputTokens, 1500); assert.equal(c.cacheWriteTokens, 300); assert.equal(c.cacheReusePercent, 10);
c = inputCacheUsage('openai', [{ input_tokens: 1000, input_cached_tokens: 800, output_tokens: 9000 }]);
assert.equal(c.freshInputTokens, 200); assert.equal(c.cacheReusePercent, 80); assert.equal(c.cacheWriteTokens, null);
assert.equal(inputCacheUsage('openai', [{ input_tokens: 1000 }]).cacheReadTokens, null);
assert.equal(inputCacheUsage('openai', [{ input_tokens: 100, input_cached_tokens: 200 }]).freshInputTokens, null);
assert.equal(inputCacheUsage('anthropic', [{ ...anthropicRow, cache_creation: null }]).cacheWriteTokens, null);
assert.equal(inputCacheUsage('openai', []).cacheReusePercent, null);
assert.equal(inputCacheUsage('anthropic', [{ ...anthropicRow, cache_read_input_tokens: -1 }]).cacheReadTokens, null);
const config = { mode: 'api', adminKey: 'test', apiKey: '', requestsPerMinuteLimit: '', tokensPerMinuteLimit: '', monthlyBudgetUsd: '' };
const report = (rows, next = null) => ({ data: [{ results: rows }], has_more: next !== null, next_page: next });
let failSecondPage = false;
const calls = [];
global.fetch = async (url) => {
  calls.push(url);
  const u = new URL(url);
  let json;
  if (u.pathname.includes('usage/completions')) {
    assert.equal(u.searchParams.get('bucket_width'), '1h');
    if (u.searchParams.has('page') && failSecondPage) throw new Error('offline');
    json = u.searchParams.has('page') ? report([{ input_tokens: 300, input_cached_tokens: 100, output_tokens: 40, num_model_requests: 2 }]) : report([{ input_tokens: 1000, input_cached_tokens: 800, output_tokens: 100, num_model_requests: 1 }], 'next');
  } else if (u.pathname.includes('usage_report')) {
    json = u.searchParams.has('page') ? report([anthropicRow]) : report([anthropicRow], 'next');
  } else if (u.pathname.includes('cost_report')) {
    json = report([{ amount: '123', currency: 'USD' }]);
  } else if (u.pathname.includes('costs')) {
    json = report([{ amount: { value: 1.23, currency: 'usd' } }]);
  } else json = {};
  return { ok: true, json: async () => json };
};
(async () => {
  const { buildSnapshot } = load('@/lib/provider-clients');
  let snapshot = await buildSnapshot('openai', config);
  assert.equal(snapshot.usage.tokensUsed, 1440, 'OpenAI cached input must not be counted twice');
  assert.equal(snapshot.usage.inputCache.cacheReadTokens, 900);
  assert.equal(snapshot.usage.inputCache.freshInputTokens, 400);
  assert.equal(snapshot.usage.monthlySpendUsd, 1.23);
  assert.equal(snapshot.usage.requestsUsed, 3);
  snapshot = await buildSnapshot('anthropic', config);
  assert.equal(snapshot.usage.tokensUsed, 5000, 'Anthropic nested cache writes must be included');
  assert.equal(snapshot.usage.inputCache.cacheWriteTokens, 600);
  assert.equal(snapshot.usage.inputCache.cacheReusePercent, 10);
  assert.equal(snapshot.usage.monthlySpendUsd, 1.23, 'Anthropic cost report amounts are cents');
  failSecondPage = true;
  await assert.rejects(buildSnapshot('openai', config), /offline/, 'partial report must not publish a misleading ratio');
  console.log('Input cache checks passed (provider schemas, writes, totals, missing fields, empty usage, pagination, partial failures).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
