const test = require("node:test");
const assert = require("node:assert/strict");
const { patchPodfile } = require("../plugins/with-expo-modules-core-swift");

const podfile = `target 'SavoryMind' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

test("adds the compatibility settings after React Native's installer for only the affected Xcode and pod", () => {
  const patched = patchPodfile(podfile);
  assert.match(patched, /\)\n    # SavoryMind[^\n]*\n    if .* == "Xcode 26\.2"\n/);
  assert.match(patched, /targets\.each do \|target\|\n        next unless target\.name == "ExpoModulesCore"\n/);
  assert.match(patched, /"SWIFT_VERSION".*= "5\.0"/);
  assert.match(patched, /"SWIFT_STRICT_CONCURRENCY".*= "minimal"/);
  assert.match(patched, /"SWIFT_COMPILATION_MODE".*= "singlefile"/);
  assert.equal(patchPodfile(patched), patched);
});

test("preserves CRLF and fails loudly if Expo removes the expected hook", () => {
  const patched = patchPodfile(podfile.replaceAll("\n", "\r\n"));
  assert.equal(patched.replaceAll("\r\n", "").includes("\n"), false);
  assert.throws(() => patchPodfile(""), /post_install changed/);
});
