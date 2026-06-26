// Jest mock for expo-clipboard. Native module would otherwise throw in
// the test environment. Resolves so tests that copy a link don't hang.
module.exports = {
  setStringAsync: jest.fn(() => Promise.resolve(true)),
  getStringAsync: jest.fn(() => Promise.resolve('')),
};
