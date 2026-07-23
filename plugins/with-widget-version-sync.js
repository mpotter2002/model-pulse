const { withXcodeProject } = require('@expo/config-plugins');

const WIDGET_INFOPLIST_FRAGMENT = 'ExpoWidgetsTarget/Info.plist';

/**
 * expo-widgets creates the widget extension target with
 * GENERATE_INFOPLIST_FILE = YES. At archive time xcodebuild then regenerates
 * CFBundleVersion / CFBundleShortVersionString from the target's static
 * CURRENT_PROJECT_VERSION (1) / MARKETING_VERSION (1.0) build settings,
 * overriding the real values EAS Build writes into the extension's
 * Info.plist when using remote appVersionSource. Result: the app ships as
 * build N while the embedded widget ships as build 1, and xcodebuild warns
 * the versions must match.
 *
 * Flipping GENERATE_INFOPLIST_FILE to NO makes the compiled appex use the
 * Info.plist file as written (and patched by EAS), so versions stay in sync.
 */
function withWidgetVersionSync(config) {
  // Like with-widget-fonts, app.json lists this plugin BEFORE expo-widgets.
  // Expo's mod pipeline is a stack, so earlier registration executes AFTER
  // expo-widgets has created the ExpoWidgetsTarget in the xcodeProject mod.
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const buildConfigs = project.hash.project.objects['XCBuildConfiguration'] ?? {};
    let touched = 0;
    for (const key of Object.keys(buildConfigs)) {
      const entry = buildConfigs[key];
      const infoPlistFile = entry?.buildSettings?.INFOPLIST_FILE;
      if (typeof infoPlistFile === 'string' && infoPlistFile.includes(WIDGET_INFOPLIST_FRAGMENT)) {
        if (entry.buildSettings.GENERATE_INFOPLIST_FILE !== 'NO') {
          entry.buildSettings.GENERATE_INFOPLIST_FILE = 'NO';
          touched += 1;
        }
      }
    }
    console.log(
      `[with-widget-version-sync] Set GENERATE_INFOPLIST_FILE=NO on ${touched} ExpoWidgetsTarget build configuration(s).`
    );
    return config;
  });
}

module.exports = withWidgetVersionSync;
