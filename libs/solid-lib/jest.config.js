module.exports = {
  displayName: 'solid-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': ['ts-jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/solid-lib',
  coverageReporters: [["lcov", {"projectRoot": "./"}]],
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.spec.json',
      babelConfig: '<rootDir>/babel.config.js',
    },
    __DEV__: true,
    __TEST__: true,
  },
  moduleNameMapper: {
    '^solid-js$': '<rootDir>/../../node_modules/solid-js/dist/solid.cjs',
    '^solid-js/web$': '<rootDir>/../../node_modules/solid-js/web/dist/web.cjs',
  },
};
