const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSdk } = require('./check-sdk.cjs');
test('rejects a partial Expo SDK upgrade and stale localization module', () => {
  assert.equal(validateSdk({ 'expo-router': '55.0.18', 'expo-localization': '17.0.8', 'react-native': '0.83.10' },
    { 'expo-router': '~58.0.0', 'expo-localization': '~58.0.0', 'react-native': '0.88.1' }).length, 3);
});
test('permits security patches within supported React and Expo families', () => {
  assert.deepEqual(validateSdk({ react: '19.2.5', 'expo-router': '55.0.19' },
    { react: '19.2.0', 'expo-router': '~55.0.18' }), []);
});
