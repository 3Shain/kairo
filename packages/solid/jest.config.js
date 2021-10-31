module.exports = {
  displayName: 'solid',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': ['ts-jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/solid',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  globals: {
    'ts-jest': {
      babelConfig: '<rootDir>/babel.config.js',
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
    __DEV__: true,
    __TEST__: true,
  },
  moduleNameMapper: {
    '^solid-js$': '<rootDir>/../../node_modules/solid-js/dist/solid.cjs',
    '^solid-js/web$': '<rootDir>/../../node_modules/solid-js/web/dist/web.cjs',
  },
};
