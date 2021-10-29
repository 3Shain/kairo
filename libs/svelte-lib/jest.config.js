
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: 'libs/svelte-lib/tests/svelte.config.js',
      },
    ],
  },
  testMatch: ["**/*.spec.ts?(x)", "!**/*.ssr.spec.ts?(x)"],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'svelte'],
  coverageDirectory: '../../coverage/libs/svelte-lib',
  testEnvironment: 'jsdom',
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
    __DEV__: true,
    __TEST__: true,
  },
  moduleNameMapper: {
    '^@kairo/svelte$': '<rootDir>/src/',
    '^kairo$': '<rootDir>/../kairo/src',
  },
};
