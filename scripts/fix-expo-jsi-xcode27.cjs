const fs = require('node:fs');
const path = require('node:path');

// Swift in Xcode 27 rejects converting a function to a C callback inside a
// conditional expression. Keep the SDK 56 behavior, including the null setter,
// by passing direct function references in each branch instead.
const pkg = require.resolve('expo-modules-jsi/package.json');
if (require(pkg).version.startsWith('56.')) {
  const file = path.join(path.dirname(pkg), 'apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift');
  const source = fs.readFileSync(file, 'utf8');
  const original = `    let callbacks = expo.HostObjectCallbacks(
      context, getter, set == nil ? nil : setter, propertyNamesGetter, deallocate)`;
  const fixed = `    // Model Pulse: direct C callback conversion for Xcode 27.
    let callbacks: expo.HostObjectCallbacks
    if set == nil {
      callbacks = expo.HostObjectCallbacks(context, getter, nil, propertyNamesGetter, deallocate)
    } else {
      callbacks = expo.HostObjectCallbacks(context, getter, setter, propertyNamesGetter, deallocate)
    }`;
  if (source.includes(original)) {
    fs.writeFileSync(file, source.replace(original, fixed));
    console.log('Applied SDK 56 JSI compatibility fix for Xcode 27.');
  } else if (!source.includes(fixed)) {
    throw new Error('Expo JSI source changed; review the Xcode 27 compatibility fix.');
  }
}
