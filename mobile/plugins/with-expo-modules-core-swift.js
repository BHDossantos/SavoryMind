// Temporary workaround for Xcode 26.2 / Swift 6.2.3 crashing in
// ExpoModulesCore SharedObject.emit (https://github.com/expo/expo/issues/43199).
const marker = "# SavoryMind: Xcode 26.2 ExpoModulesCore compiler workaround";
const postInstallEnd = /(    react_native_post_install\(\r?\n[\s\S]*?\r?\n    \))(?=\r?\n  end)/g;

function patchPodfile(contents) {
  if (contents.includes(marker)) return contents;
  if ([...contents.matchAll(postInstallEnd)].length !== 1) {
    throw new Error("Expo Podfile post_install changed; review the Xcode 26.2 workaround.");
  }

  const workaround = [
    `    ${marker}`,
    '    if `xcodebuild -version`.lines.first.to_s.strip == "Xcode 26.2"',
    '      installer.pods_project.targets.each do |target|',
    '        next unless target.name == "ExpoModulesCore"',
    '        target.build_configurations.each do |configuration|',
    '          configuration.build_settings["SWIFT_VERSION"] = "5.0"',
    '          configuration.build_settings["SWIFT_STRICT_CONCURRENCY"] = "minimal"',
    '          configuration.build_settings["SWIFT_COMPILATION_MODE"] = "singlefile"',
    '        end',
    '      end',
    '    end',
  ];
  const eol = contents.includes("\r\n") ? "\r\n" : "\n";
  return contents.replace(postInstallEnd, (match) => match + eol + workaround.join(eol));
}

module.exports = function withExpoModulesCoreSwift(config) {
  const { withPodfile } = require("expo/config-plugins");
  return withPodfile(config, (mod) => {
    mod.modResults.contents = patchPodfile(mod.modResults.contents);
    return mod;
  });
};
module.exports.patchPodfile = patchPodfile;
