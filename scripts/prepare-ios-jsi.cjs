const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Prepare the device slice after CocoaPods, before the outer Xcode archive.
// Xcode 27's nested SPM build can emit an erroneous "failed with exit code 0"
// diagnostic even when it produces a valid framework. Building this standalone
// keeps that diagnostic out of the enclosing archive's build result. Actual
// compiler failures remain fatal; the existing Expo phase validates its cache.
if (process.env.EAS_BUILD_PLATFORM === 'ios') {
  const root = path.resolve(__dirname, '..');
  const pkg = require.resolve('expo-modules-jsi/package.json');
  const script = path.join(path.dirname(pkg), 'apple/scripts/build-xcframework.sh');
  const result = spawnSync('bash', [script], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PODS_ROOT: path.join(root, 'ios/Pods'), PLATFORM_NAME: 'iphoneos' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
