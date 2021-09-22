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
  coverageDirectory: '../../coverage/libs/svelte-lib',
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.spec.json',
    },
    __DEV__: true,
    __TEST__: true,
  },
  moduleNameMapper: {
    '^@kairo/svelte$': '<rootDir>/src/',
    '^kairo$': '<rootDir>/../kairo/src',
  },
};
