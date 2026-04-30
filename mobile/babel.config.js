module.exports = function (api) {
  api.cache(true);
  // Jest sets NODE_ENV=test. The Expo presets pull in native-only Babel
  // plugins (reanimated, expo runtime) that don't apply to the Node test
  // environment and would fail to resolve when only the test deps are
  // installed. Swap to plain preset-env for the test build so api.js can
  // be transformed without the full RN / Expo toolchain.
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: isTest
      ? [['@babel/preset-env', { targets: { node: 'current' } }]]
      : ['babel-preset-expo'],
    plugins: isTest ? [] : ['react-native-reanimated/plugin'],
  };
};
