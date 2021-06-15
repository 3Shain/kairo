module.exports = {
  transform: {
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: 'libs/svelte-lib/tests/svelte.config.js',
      },
    ],
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'svelte'],
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
