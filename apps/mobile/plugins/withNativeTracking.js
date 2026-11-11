const fs = require("node:fs");
const path = require("node:path");
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require("expo/config-plugins");

const LOCATION_DEPENDENCY =
  'implementation("com.google.android.gms:play-services-location:21.3.0")';
// Powers the TrackingWatchdogWorker backstop that restarts the service while the
// app is backgrounded (aggressive-OEM kill recovery).
const WORK_DEPENDENCY = 'implementation("androidx.work:work-runtime:2.9.1")';
const TEMPLATE_FILES = [
  "ForegroundLocationService.kt",
  "BootCompletedReceiver.kt",
  "NativeTrackingModule.kt",
  "NativeTrackingPackage.kt",
  "TrackingWatchdogWorker.kt",
];

function addManifestComponents(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.service = application.service || [];
  application.receiver = application.receiver || [];

  if (
    !application.service.some(
      (entry) => entry.$?.["android:name"] === ".tracking.ForegroundLocationService",
    )
  ) {
    application.service.push({
      $: {
        "android:name": ".tracking.ForegroundLocationService",
        "android:enabled": "true",
        "android:exported": "false",
        "android:foregroundServiceType": "location",
      },
    });
  }

  if (
    !application.receiver.some(
      (entry) => entry.$?.["android:name"] === ".tracking.BootCompletedReceiver",
    )
  ) {
    application.receiver.push({
      $: {
        "android:name": ".tracking.BootCompletedReceiver",
        "android:enabled": "true",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
            { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
          ],
        },
      ],
    });
  }

  return manifest;
}

function addLocationDependency(contents) {
  let next = contents;
  if (!next.includes("com.google.android.gms:play-services-location")) {
    next = next.replace(
      /dependencies\s*\{/,
      `dependencies {\n    ${LOCATION_DEPENDENCY}`,
    );
  }
  if (!next.includes("androidx.work:work-runtime")) {
    next = next.replace(
      /dependencies\s*\{/,
      `dependencies {\n    ${WORK_DEPENDENCY}`,
    );
  }
  return next;
}

function registerNativePackage(contents, packageName) {
  const importLine = `import ${packageName}.tracking.NativeTrackingPackage`;
  let next = contents;
  if (!next.includes(importLine)) {
    next = next.replace(
      /(\nimport expo\.modules\.)/,
      `\n${importLine}\n$1`,
    );
  }
  if (!next.includes("add(NativeTrackingPackage())")) {
    next = next.replace(
      /(PackageList\(this\)\.packages\.apply\s*\{)/,
      "$1\n          add(NativeTrackingPackage())",
    );
  }
  return next;
}

function writeNativeSources(projectRoot, packageName) {
  const templateRoot = path.join(projectRoot, "plugins", "native-tracking");
  const destination = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "main",
    "java",
    ...packageName.split("."),
    "tracking",
  );
  fs.mkdirSync(destination, { recursive: true });
  for (const file of TEMPLATE_FILES) {
    const template = fs.readFileSync(path.join(templateRoot, file), "utf8");
    fs.writeFileSync(
      path.join(destination, file),
      template.replaceAll("__PACKAGE__", packageName),
    );
  }
}

module.exports = function withNativeTracking(config) {
  const packageName = config.android?.package;
  if (!packageName) {
    throw new Error("withNativeTracking requires expo.android.package");
  }

  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = addManifestComponents(cfg.modResults);
    return cfg;
  });
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addLocationDependency(cfg.modResults.contents);
    return cfg;
  });
  config = withMainApplication(config, (cfg) => {
    cfg.modResults.contents = registerNativePackage(
      cfg.modResults.contents,
      packageName,
    );
    return cfg;
  });
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      writeNativeSources(cfg.modRequest.projectRoot, packageName);
      return cfg;
    },
  ]);
};

module.exports.addLocationDependency = addLocationDependency;
module.exports.addManifestComponents = addManifestComponents;
module.exports.registerNativePackage = registerNativePackage;
module.exports.writeNativeSources = writeNativeSources;
