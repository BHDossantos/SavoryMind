module.exports = function (api) {
  api.cache(true);
  // Always use babel-preset-expo (jest-expo expects it). Skip the
  // reanimated plugin in test mode — it tries to transform worklet
  // syntax that isn't reachable from Node and the plugin can warn
  // noisily in CI without adding any test value.
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: ['babel-preset-expo'],
    plugins: isTest ? [] : ['react-native-reanimated/plugin'],
  };
};
