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
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'svelte'],
  coverageProvider: 'v8',
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
