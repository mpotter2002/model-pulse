const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const values = new Map();
let readFailure = false;
let statusHook = null;
const statuses = new Map();
const savedUsage = new Map();
const timelines = [];
const cards = [
  { id: 'openai', title: 'ChatGPT / OpenAI', apiProviderId: 'openai', subscriptionProviderId: 'codex-sub', accent: '#00FF00' },
  { id: 'anthropic', title: 'Claude / Anthropic', apiProviderId: 'anthropic', subscriptionProviderId: 'claude-sub', accent: '#FF0000' },
];
const mocks = {
  '@/lib/background-secure-store': {
    getItemAsync: async (key) => { if (readFailure) throw new Error('Keychain temporarily unavailable'); return values.get(key) ?? null; },
    setItemAsync: async (key, value) => values.set(key, value),
  },
  '@/lib/model-cards': { makeModelCards: () => cards },
  '@/lib/oauth/manager': { getConnectionStatus: async (id, options) => {
    assert.equal(options.allowNetwork, false, 'widget publication must not fetch providers again');
    if (statusHook) return statusHook(id);
    return statuses.get(id) ?? { kind: 'disconnected' };
  } },
  '@/lib/oauth/usage-store': { loadPersistedUsage: async (id) => savedUsage.get(id) ?? null },
  '@/widgets/signal-stack-widget': { signalStackWidget: { updateTimeline: async (entries) => timelines.push(entries) } },
};
const modules = new Map();
function load(name) {
  if (mocks[name]) return mocks[name];
  if (modules.has(name)) return modules.get(name).exports;
  const file = path.join(root, 'src', name.slice(2) + '.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; modules.set(name, module);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(load, module, module.exports);
  return module.exports;
}
const usage = (percent = 85) => ({ summary: null, limits: [{ label: 'Weekly window', used: null, limit: null, percentUsed: percent, resetHint: 'resets in 1d' }], planLabel: 'Subscription', fetchState: 'live' });
const connected = (percent = 85) => ({ kind: 'connected', usage: usage(percent), updatedAt: '9:00 AM' });
(async () => {
  const { DEFAULT_STORED_STATE, demoSnapshot, PROVIDER_ORDER } = load('@/lib/providers');
  const { loadStoredState } = load('@/lib/storage');
  const { syncSignalStackWidget } = load('@/widgets/widget-sync');
  let state = { ...DEFAULT_STORED_STATE, widgetConfig: { ...DEFAULT_STORED_STATE.widgetConfig, metricMode: 'subscription', visibleModelCardIds: ['openai', 'anthropic'] } };
  const persist = () => values.set('signalstack-state-v1', JSON.stringify(state));
  persist();
  const snapshots = Object.fromEntries(PROVIDER_ORDER.map((id) => [id, {
    ...demoSnapshot(id), mode: 'live', monthlyBudgetUsd: 100,
    usage: { ...demoSnapshot(id).usage, monthlySpendUsd: 90 },
  }]));
  const sync = async () => {
    const stored = await loadStoredState({ strict: true });
    return syncSignalStackWidget(snapshots, stored.widgetConfig, stored.rateLimitStyle, stored.hiddenModelCardIds);
  };
  const latest = () => timelines.at(-1)[0].props;
  statuses.set('codex-sub', connected()); statuses.set('claude-sub', connected(60));
  await sync();
  assert.equal(latest().metricLabel, 'Limits');
  assert.equal(latest().cards[0].metric, '85%');
  assert.match(latest().cards[0].limitRows[0].label, /Weekly/);
  assert.ok(latest().cards.every((card) => card.limitRows.every((row) => !row.label.includes('budget'))));

  statuses.set('codex-sub', { kind: 'disconnected' });
  await sync();
  assert.equal(latest().metricLabel, 'Limits');
  assert.equal(latest().cards[0].metric, 'Open app to refresh');
  assert.equal(latest().cards[0].limitRows, undefined, 'subscription view must not fall back to API budget bars');

  savedUsage.set('codex-sub', { usage: usage(), fetchedAt: Date.now() - 86400000 });
  statuses.set('codex-sub', { kind: 'error', message: 'Token expired' });
  await sync();
  assert.equal(latest().cards[0].metric, '85%', 'expired token retains last known subscription data');
  assert.equal(latest().cards[0].status, 'Last known usage');
  assert.equal(latest().hasStaleData, true);
  statuses.set('codex-sub', { kind: 'disconnected' });
  await sync();
  assert.equal(latest().cards[0].metric, 'Open app to refresh', 'disconnected account must not resurrect cached usage');

  const stored = await loadStoredState({ strict: true });
  const count = timelines.length;
  const warn = console.warn; console.warn = () => {};
  readFailure = true;
  await assert.rejects(loadStoredState({ strict: true }));
  await syncSignalStackWidget(snapshots, stored.widgetConfig, stored.rateLimitStyle, stored.hiddenModelCardIds);
  assert.equal(timelines.length, count, 'unreadable settings preserve the previous timeline');
  readFailure = false;
  values.set('signalstack-state-v1', '{broken');
  await syncSignalStackWidget(snapshots, stored.widgetConfig, stored.rateLimitStyle, stored.hiddenModelCardIds);
  assert.equal(timelines.length, count, 'invalid settings preserve the previous timeline');
  console.warn = warn; persist();

  state.widgetConfig = { ...state.widgetConfig, metricMode: 'api' }; persist();
  statuses.set('codex-sub', connected());
  await sync();
  assert.equal(latest().metricLabel, 'Balance');
  assert.equal(latest().cards[0].metric, '$90.00');
  assert.match(latest().cards[0].limitRows[0].label, /budget/);
  snapshots.openai.mode = 'failed';
  await sync();
  assert.equal(latest().cards[0].limitRows, undefined, 'API view must not fall back to subscription bars');
  snapshots.openai.mode = 'live';
  await syncSignalStackWidget(snapshots, stored.widgetConfig, stored.rateLimitStyle, stored.hiddenModelCardIds);
  assert.equal(latest().metricLabel, 'Balance', 'a late subscription sync cannot undo the saved API mode');

  state.widgetConfig = { ...state.widgetConfig, metricMode: 'subscription' }; persist();
  let releaseOld;
  let startedOld;
  const started = new Promise((resolve) => { startedOld = resolve; });
  statusHook = async (id) => {
    if (id !== 'codex-sub') return connected(60);
    startedOld();
    return new Promise((resolve) => { releaseOld = () => resolve(connected(10)); });
  };
  const beforeRace = timelines.length;
  const old = sync();
  await started;
  statusHook = null; statuses.set('codex-sub', connected(95));
  await sync();
  releaseOld(); await old;
  assert.equal(timelines.length, beforeRace + 1, 'slower old sync must not overwrite the newer timeline');
  assert.equal(latest().cards[0].metric, '95%');
  console.log('Widget regression checks passed (source selection, cached limits, strict settings reads, no duplicate fetching, stale sync rejection).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
