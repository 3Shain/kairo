/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  displayName: 'concurrency',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ['**/*.spec.ts?(x)'],
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../coverage/packages/concurrency',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
    __DEV__: true,
    __TEST__: true,
  },
};
