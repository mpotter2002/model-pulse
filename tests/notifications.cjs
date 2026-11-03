// Native APIs are mocked; actual lock-screen delivery still needs a device test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const storage = new Map();
const writes = [];
const pending = new Map();
const delivered = [];
let failNext = false;
let locked = false;
let consent = true;
let settingsUnavailable = false;
let permission = true;
let prefs = { enabled: true, thresholds: [50, 80, 90], subscriptionAlerts: true, resetAlerts: true, apiBudgetAlerts: true };
const nativeStore = {
  AFTER_FIRST_UNLOCK: 1,
  getItemAsync: async (key, options) => {
    const value = storage.get(`${options?.keychainService ?? 'legacy'}:${key}`) ?? null;
    if (locked && value !== null && !options?.keychainService) throw new Error('Legacy item unavailable while locked');
    return value;
  },
  setItemAsync: async (key, value, options) => { storage.set(`${options?.keychainService ?? 'legacy'}:${key}`, value); writes.push({ key, value, options }); },
  deleteItemAsync: async (key, options) => storage.delete(`${options?.keychainService ?? 'legacy'}:${key}`),
};
const mocks = {
  'expo-secure-store': nativeStore,
  'react-native': { Platform: { OS: 'ios' } },
  'expo-notifications': {
    SchedulableTriggerInputTypes: { DATE: 'date' },
    getPermissionsAsync: async () => ({ granted: permission }),
    getAllScheduledNotificationsAsync: async () => [...pending.values()],
    cancelScheduledNotificationAsync: async (id) => pending.delete(id),
    scheduleNotificationAsync: async (request) => {
      if (failNext) { failNext = false; throw new Error('test delivery failure'); }
      if (request.trigger === null) delivered.push(request);
      else pending.set(request.identifier, request);
      return request.identifier ?? `sent-${delivered.length}`;
    },
  },
  '@/lib/storage': { loadStoredState: async () => { if (settingsUnavailable) throw new Error('Keychain unavailable'); return { notificationPrefs: prefs }; } },
  '@/lib/provider-data-sharing': { isProviderDataSharingAllowed: async () => consent },
  '@/lib/oauth/providers': { SUBSCRIPTION_PROVIDERS: { 'codex-sub': { shortLabel: 'ChatGPT' } } },
  '@/lib/providers': { PROVIDERS: {} },
};
const modules = new Map();
function load(name) {
  if (mocks[name]) return mocks[name];
  if (modules.has(name)) return modules.get(name).exports;
  assert.ok(name.startsWith('@/'), `Unexpected module: ${name}`);
  const file = path.join(root, 'src', name.slice(2) + '.ts');
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  modules.set(name, module);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(load, module, module.exports);
  return module.exports;
}

(async () => {
  const secure = load('@/lib/background-secure-store');
  storage.set('legacy:legacy', 'old');
  await secure.getItemAsync('legacy');
  assert.equal(writes.at(-1).options.keychainAccessible, nativeStore.AFTER_FIRST_UNLOCK);
  assert.equal(writes.at(-1).options.keychainService, 'modelpulse-background-v1');
  assert.equal(storage.has('legacy:legacy'), false, 'legacy item is removed after migration');
  locked = true;
  assert.equal(await secure.getItemAsync('legacy'), 'old', 'migrated item remains readable while locked');
  locked = false;
  await Promise.all([secure.getItemAsync('legacy'), secure.setItemAsync('legacy', 'new')]);
  assert.equal(storage.get('modelpulse-background-v1:legacy'), 'new', 'migration must not overwrite newer credentials');
  await secure.deleteItemAsync('legacy');
  assert.equal(storage.has('modelpulse-background-v1:legacy'), false);

  const { evaluateUsageAlerts, cancelUsageResetAlerts } = load('@/lib/notifications');
  let resetAt = Date.now() + 3_600_000;
  const args = (percent = 85, time = resetAt) => ({
    prefs, apiSnapshots: {},
    subscriptionUsages: [{ providerId: 'codex-sub', usage: { limits: [{ label: 'Weekly', percentUsed: percent, resetAt: time, resetHint: 'resets in 1h' }] } }],
  });
  pending.set('unrelated', { identifier: 'unrelated', content: { data: {} } });
  // Existing installs retain their already-fired thresholds when gaining reset timestamps.
  storage.set('legacy:modelpulse-notification-alerts-v1', JSON.stringify({ 'sub:codex-sub:weekly': [50, 80] }));
  await evaluateUsageAlerts(args());
  assert.equal(delivered.length, 0);
  await evaluateUsageAlerts(args());
  assert.equal(delivered.length, 0, 'migration must preserve dedupe across evaluations');
  const reminder = [...pending.values()].find((r) => r.identifier !== 'unrelated');
  assert.equal(reminder.trigger.type, 'date');
  assert.equal(reminder.trigger.date.getTime(), resetAt);
  assert.equal(pending.size, 2);
  settingsUnavailable = true;
  await assert.rejects(evaluateUsageAlerts(args()));
  assert.equal(pending.size, 2, 'unreadable settings must preserve scheduled reminders');
  settingsUnavailable = false;

  await evaluateUsageAlerts({ ...args(95), notifyThresholds: false });
  assert.equal(delivered.length, 0, 'cached preference reconciliation cannot emit catch-up thresholds');
  const staleArgs = args(95);
  staleArgs.subscriptionUsages[0].usage.fetchState = 'rate_limited';
  await evaluateUsageAlerts(staleArgs);
  assert.equal(delivered.length, 0, 'failed/throttled provider snapshots cannot emit threshold alerts');
  const ledgerKey = 'modelpulse-background-v1:modelpulse-notification-alerts-v1';
  const goodLedger = storage.get(ledgerKey);
  storage.set(ledgerKey, '{corrupt');
  await assert.rejects(evaluateUsageAlerts(args(95)), /JSON|position|Expected/);
  assert.equal(delivered.length, 0, 'invalid dedupe history must not resend every alert');
  storage.set(ledgerKey, goodLedger);

  await Promise.all([evaluateUsageAlerts(args(95)), evaluateUsageAlerts(args(95))]);
  assert.equal(delivered.length, 1, 'concurrent evaluations must send one threshold alert');
  assert.match(delivered[0].content.body, /90% alert/);
  assert.equal(pending.size, 2, 'unchanged reset time must not create another reminder');

  await evaluateUsageAlerts({ prefs, apiSnapshots: {}, subscriptionUsages: [] });
  assert.equal(pending.size, 2, 'unavailable provider must retain its scheduled reset');
  resetAt += 7 * 86_400_000;
  await evaluateUsageAlerts(args(10));
  assert.equal(pending.size, 1, 'a fresh low-usage window cancels the old reminder');
  assert.equal(delivered.length, 1, 'opening after a timed reset must not send a late reset alert');

  const warn = console.warn;
  console.warn = () => {};
  failNext = true;
  await evaluateUsageAlerts(args());
  await evaluateUsageAlerts(args());
  console.warn = warn;
  assert.equal(delivered.length, 2, 'a failed threshold delivery must be retried');
  assert.equal(pending.size, 2);
  await cancelUsageResetAlerts('codex-sub');
  assert.equal(pending.size, 1, 'disconnect cancels provider reminders');
  await evaluateUsageAlerts(args());
  prefs = { ...prefs, resetAlerts: false };
  await evaluateUsageAlerts(args());
  assert.equal(pending.size, 1, 'disabling reset alerts cancels queued reminders');
  prefs = { ...prefs, resetAlerts: true };
  await evaluateUsageAlerts(args());
  consent = false;
  await evaluateUsageAlerts(args());
  assert.equal(pending.size, 1, 'revoking consent cancels queued reminders');
  consent = true;
  await evaluateUsageAlerts(args());
  permission = false;
  await evaluateUsageAlerts(args());
  assert.equal(pending.size, 1, 'revoking notification permission clears pending reminders');
  permission = true;
  await evaluateUsageAlerts(args());
  prefs = { ...prefs, enabled: false };
  await evaluateUsageAlerts(args());
  assert.equal(pending.size, 1, 'stale refresh arguments cannot restore disabled alerts');
  prefs = { ...prefs, enabled: true };
  const count = delivered.length;
  await evaluateUsageAlerts(args(99, Date.now() - 1000));
  assert.equal(delivered.length, count, 'expired cached windows must not send thresholds');
  assert.ok(pending.has('unrelated'), 'feature cancellation must preserve unrelated notifications');
  console.log('Notification regression checks passed (Keychain migration, timed resets, dedupe, retries, cancellation, expired windows).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
