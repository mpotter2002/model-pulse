const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;
const fs = require('fs');
const path = require('path');

const WIDGET_INFOPLIST_FRAGMENT = 'ExpoWidgetsTarget/Info.plist';

// Keys Xcode normally injects into a generated Info.plist. With
// GENERATE_INFOPLIST_FILE=NO the file is used verbatim, so these must be
// present or the built appex is an invalid bundle (AppIntents SSU training
// fails at archive time with "Unable to parse Info.plist").
// NOTE: CFBundleVersion / CFBundleShortVersionString stay as literal values
// in the file on purpose - EAS Build patches them with the real version on
// the builder, and a $(CURRENT_PROJECT_VERSION) variable would clobber that.
const REQUIRED_INFOPLIST_KEYS = {
  CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
  CFBundleExecutable: '$(EXECUTABLE_NAME)',
  CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
  CFBundleInfoDictionaryVersion: '6.0',
  CFBundleName: '$(PRODUCT_NAME)',
  CFBundlePackageType: 'XPC!',
  CFBundleTypeRole: 'Editor',
  LSMinimumSystemVersion: '$(IPHONEOS_DEPLOYMENT_TARGET)',
};

function withWidgetVersionSync(config) {
  // Like with-widget-fonts, app.json lists this plugin BEFORE expo-widgets.
  // Expo's mod pipeline is a stack, so earlier registration executes AFTER
  // expo-widgets has created the ExpoWidgetsTarget in the xcodeProject mod.
  config = withXcodeProject(config, (config) => {
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

  // Dangerous mods run after the project files are written, so the
  // expo-widgets-generated Info.plist exists by the time this runs.
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const infoPlistPath = path.join(
        config.modRequest.platformProjectRoot,
        WIDGET_INFOPLIST_FRAGMENT
      );
      if (!fs.existsSync(infoPlistPath)) {
        console.warn(`[with-widget-version-sync] ${WIDGET_INFOPLIST_FRAGMENT} not found, skipping key merge.`);
        return config;
      }
      const parsed = plist.parse(fs.readFileSync(infoPlistPath, 'utf8'));
      const added = [];
      for (const [key, value] of Object.entries(REQUIRED_INFOPLIST_KEYS)) {
        if (!(key in parsed)) {
          parsed[key] = value;
          added.push(key);
        }
      }
      if (added.length > 0) {
        fs.writeFileSync(infoPlistPath, plist.build(parsed));
      }
      console.log(
        `[with-widget-version-sync] Merged ${added.length} required key(s) into ${WIDGET_INFOPLIST_FRAGMENT}.`
      );
      return config;
    },
  ]);

  return config;
}

module.exports = withWidgetVersionSync;
