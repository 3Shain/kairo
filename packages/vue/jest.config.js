
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  displayName: 'vue',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.vue$': '@kairo/vue3-jest',
    '.+\\.(css|styl|less|sass|scss|svg|png|jpg|ttf|woff|woff2)$':
      'jest-transform-stub',
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'vue', 'js', 'json'],
  coverageDirectory: '../../coverage/packages/vue',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  setupFiles: ['./tests/setup.ts'],
  globals: {
    'ts-jest': {
      babelConfig: '<rootDir>/babel.config.js',
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
    'vue-jest': {
      tsConfig: 'packages/vue/tsconfig.spec.json',
    },
    __DEV__: true,
    __TEST__: true,
  },
  snapshotSerializers: ['jest-serializer-vue'],
};
