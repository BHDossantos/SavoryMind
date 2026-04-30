// Plain in-memory replacement for expo-secure-store, wired via jest's
// moduleNameMapper so api.js can be tested in Node without the
// expo-secure-store package being installed.
//
// Tests use SecureStore.__resetMockStore() in beforeEach to wipe state
// between cases.

const _store = new Map();

module.exports = {
  getItemAsync: (key) => Promise.resolve(_store.has(key) ? _store.get(key) : null),
  setItemAsync: (key, value) => {
    _store.set(key, value);
    return Promise.resolve();
  },
  deleteItemAsync: (key) => {
    _store.delete(key);
    return Promise.resolve();
  },
  __resetMockStore: () => _store.clear(),
};
