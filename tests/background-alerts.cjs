const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
let task;
let finishApi;
let consent = true;
let readFailure = false;
const delivered = [];
const history = [];
const registrations = [];
const mocks = {
  'expo-background-task': { BackgroundTaskResult: { Success: 1, Failed: 2 }, registerTaskAsync: async (...args) => registrations.push(args) },
  'expo-task-manager': { defineTask: (name, callback) => { task = callback; } },
  'react-native': { Platform: { OS: 'android' } },
  '@/lib/notification-diagnostics': { saveBackgroundAlertDiagnostics: async (v) => history.push({ ...v }) },
  '@/lib/notifications': { evaluateUsageAlerts: async (args) => { delivered.push(args); return 1; } },
  '@/lib/provider-data-sharing': { isProviderDataSharingAllowed: async () => consent },
  '@/lib/providers': { PROVIDER_ORDER: ['openai'], demoSnapshot: () => ({}) },
  '@/lib/storage': { loadStoredState: async () => { if (readFailure) throw new Error('locked'); return { providerConfigs: { openai: {} }, notificationPrefs: { enabled: true } }; } },
  '@/lib/provider-clients': { buildSnapshot: async () => new Promise((resolve) => { finishApi = () => resolve({ mode: 'live' }); }) },
  '@/lib/oauth/providers': { SUBSCRIPTION_PROVIDER_ORDER: ['claude-sub', 'codex-sub'] },
  '@/lib/oauth/manager': { getConnectionStatus: async (id) => { if (id === 'codex-sub') throw new Error('offline'); return { kind: 'connected', usage: { fetchState: 'live', limits: [{ percentUsed: 100 }] } }; } },
};
const file = path.resolve(__dirname, '../src/lib/background-usage-task.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })((name) => { assert.ok(mocks[name], name); return mocks[name]; }, mod, mod.exports);
(async () => {
  const running = task();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(delivered.some((a) => a.subscriptionUsages[0]?.providerId === 'claude-sub'), 'Claude limit alert must not wait for a slow API report');
  finishApi();
  assert.equal(await running, 1);
  assert.equal(history.at(-1).outcome, 'completed');
  assert.equal(history.at(-1).alertsSent, 2);
  assert.equal(history.at(-1).subscriptionsWithUsage, 1);
  consent = false;
  assert.equal(await task(), 1);
  assert.equal(history.at(-1).outcome, 'consent-required');
  consent = true; readFailure = true;
  const warn = console.warn; console.warn = () => {};
  assert.equal(await task(), 2);
  console.warn = warn;
  assert.equal(history.at(-1).outcome, 'failed');
  await mod.exports.registerUsageAlertTask();
  assert.equal(registrations[0][1].minimumInterval, 15);
  console.log('Background alert checks passed (slow-provider isolation, partial failure, consent, diagnostics, interval migration).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
