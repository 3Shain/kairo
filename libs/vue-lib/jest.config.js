module.exports = {
  displayName: 'vue-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.vue$': '@vue/vue3-jest',
    '.+\\.(css|styl|less|sass|scss|svg|png|jpg|ttf|woff|woff2)$':
      'jest-transform-stub',
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'vue', 'js', 'json'],
  coverageDirectory: '../../coverage/libs/vue-lib',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  coverageProvider: 'v8',
  globals: {
    'ts-jest': {
      babelConfig: '<rootDir>/babel.config.js',
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
    'vue-jest': {
      tsConfig: 'libs/vue-lib/tsconfig.spec.json',
    },
    __DEV__: true,
    __TEST__: true,
  },
  snapshotSerializers: ['jest-serializer-vue'],
};
