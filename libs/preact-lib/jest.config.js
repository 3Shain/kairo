module.exports = {
  displayName: 'preact-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/preact-lib',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  coverageProvider: 'v8',
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
    __DEV__: true,
    __TEST__: true,
  },
};
