const fs = require('fs');
const path = require('path');
const { withXcodeProject } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;

const FONT_FILES = [
  'SpaceGrotesk_400Regular.ttf',
  'SpaceGrotesk_500Medium.ttf',
  'SpaceGrotesk_600SemiBold.ttf',
  'SpaceGrotesk_700Bold.ttf',
  'SpaceMono_400Regular.ttf',
  'SpaceMono_700Bold.ttf',
];

const FONT_SOURCE_PATHS = [
  'node_modules/@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf',
  'node_modules/@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf',
  'node_modules/@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf',
  'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf',
  'node_modules/@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf',
  'node_modules/@expo-google-fonts/space-mono/700Bold/SpaceMono_700Bold.ttf',
];

const TARGET_NAME = 'ExpoWidgetsTarget';

function getBuildPhaseObject(project, buildPhaseType, targetUuid, comment) {
  const buildPhaseSection = project.hash.project.objects[buildPhaseType];
  const target = project.pbxNativeTargetSection()[targetUuid];
  if (!buildPhaseSection || !target?.buildPhases) {
    return null;
  }
  const buildPhase = target.buildPhases.find((bp) =>
    (!comment || bp.comment === comment) && buildPhaseSection[bp.value]
  );
  return buildPhase ? buildPhaseSection[buildPhase.value] : null;
}

function withWidgetFonts(config) {
  // app.json lists this plugin BEFORE expo-widgets. Expo's mod pipeline is a
  // stack, so the earlier registration executes AFTER expo-widgets has created
  // the ExpoWidgetsTarget in the xcodeProject mod.
  return withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const platformProjectRoot = config.modRequest.platformProjectRoot;
    const project = config.modResults;

    const nativeTargets = project.hash.project.objects['PBXNativeTarget'];
    let targetUuid = null;
    for (const key in nativeTargets) {
      if (key.endsWith('_comment')) continue;
      const target = nativeTargets[key];
      if (target.name === TARGET_NAME) {
        targetUuid = key;
        break;
      }
    }

    if (!targetUuid) {
      console.warn(`[with-widget-fonts] Could not find ${TARGET_NAME} target; skipping font embedding.`);
      return config;
    }

    console.log(`[with-widget-fonts] Embedding ${FONT_FILES.length} custom fonts into ${TARGET_NAME}.`);

    const widgetDir = path.join(platformProjectRoot, TARGET_NAME);
    const fontsDir = path.join(widgetDir, 'Fonts');
    if (!fs.existsSync(fontsDir)) {
      fs.mkdirSync(fontsDir, { recursive: true });
    }

    for (let i = 0; i < FONT_FILES.length; i++) {
      const src = path.join(projectRoot, FONT_SOURCE_PATHS[i]);
      const dest = path.join(fontsDir, FONT_FILES[i]);
      if (!fs.existsSync(src)) {
        console.warn(`[with-widget-fonts] Font source missing: ${src}; skipping.`);
        continue;
      }
      fs.copyFileSync(src, dest);
    }

    // Paths relative to the widget target directory (e.g. "Fonts/SpaceGrotesk_400Regular.ttf").
    const widgetFontRelPaths = FONT_FILES.map((file) => path.join('Fonts', file));

    // Ensure the widget target has its own PBXResourcesBuildPhase so the fonts
    // are copied into the widget bundle, not the main app bundle.
    const existingResourcesPhase = getBuildPhaseObject(project, 'PBXResourcesBuildPhase', targetUuid, 'Resources');
    if (!existingResourcesPhase) {
      project.addBuildPhase(
        widgetFontRelPaths,
        'PBXResourcesBuildPhase',
        'Resources',
        targetUuid,
        'app_extension',
        '""'
      );
    }

    // Add the font file references to the ExpoWidgetsTarget group so they show
    // in the Xcode navigator and resolve relative to the widget directory.
    const groups = project.hash.project.objects['PBXGroup'];
    let widgetGroupKey = null;
    for (const key in groups) {
      if (key.endsWith('_comment')) continue;
      const group = groups[key];
      if (group.name === TARGET_NAME) {
        widgetGroupKey = key;
        break;
      }
    }

    if (widgetGroupKey) {
      const widgetGroup = groups[widgetGroupKey];
      const existingChildren = new Set((widgetGroup.children || []).map((child) => child.value));
      const fileRefs = project.hash.project.objects['PBXFileReference'];

      for (const relPath of widgetFontRelPaths) {
        for (const key in fileRefs) {
          if (key.endsWith('_comment')) continue;
          const refPath = fileRefs[key].path;
          if (refPath === relPath || refPath === `"${relPath}"`) {
            if (!existingChildren.has(key)) {
              widgetGroup.children.push({ value: key, comment: path.basename(relPath) });
              existingChildren.add(key);
            }
            break;
          }
        }
      }
    }

    const infoPlistPath = path.join(widgetDir, 'Info.plist');
    if (fs.existsSync(infoPlistPath)) {
      const infoPlist = plist.parse(fs.readFileSync(infoPlistPath, 'utf8'));
      // Register the embedded fonts so WidgetKit can load them in the widget.
      infoPlist.UIAppFonts = FONT_FILES;
      // Ensure the widget follows the system light/dark appearance.
      infoPlist.UIUserInterfaceStyle = 'Automatic';
      fs.writeFileSync(infoPlistPath, plist.build(infoPlist));
      console.log(`[with-widget-fonts] Updated ${infoPlistPath} with UIAppFonts and UIUserInterfaceStyle=Automatic.`);
    } else {
      console.warn(`[with-widget-fonts] Could not find ${infoPlistPath}; skipping Info.plist updates.`);
    }

    return config;
  });
}

module.exports = withWidgetFonts;
