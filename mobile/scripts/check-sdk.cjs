// Catch partial SDK upgrades before bundling or native compilation.
const fs = require('node:fs');
const path = require('node:path');

function validateSdk(installed, supported) {
  const errors = [];
  for (const [name, expected] of Object.entries(supported)) {
    const actual = installed[name];
    if (!actual) continue;
    // Security patches may exceed Expo's recommended React patch. Native
    // compatibility still requires the supported major/minor release family.
    const family = (value) => value.match(expected.startsWith('^') ? /\d+/ : /\d+\.\d+/)?.[0];
    if (family(actual) !== family(expected)) errors.push(`${name}: installed ${actual}, expected family ${expected}`);
  }
  return errors;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const supported = require('expo/bundledNativeModules.json');
  const expoVersion = require('expo/package.json').version;
  const installed = {};
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (supported[name] || name === 'babel-preset-expo') installed[name] = require(`${name}/package.json`).version;
  }
  const errors = validateSdk(installed, { ...supported, 'babel-preset-expo': expoVersion });
  if (errors.length) {
    console.error(`Incompatible Expo SDK ${expoVersion} dependencies:\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else console.log(`Expo SDK ${expoVersion}: installed dependency families are aligned.`);
}
module.exports = { validateSdk };
