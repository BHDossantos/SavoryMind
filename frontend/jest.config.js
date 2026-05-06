// next/jest preset wires up SWC transforms (so we don't need babel),
// CSS / image stubs, and the right module resolution for Next.js
// projects. Anything else (jsdom env, setup file, ignore patterns)
// is layered on top.
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  moduleNameMapper: {
    // Strip CSS imports — components import them but the tests don't
    // need real styles.
    '\\.(css|less|scss)$': '<rootDir>/__mocks__/styleMock.js',
  },
};

module.exports = createJestConfig(customJestConfig);
