module.exports = {
  displayName: 'core',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
    __DEV__: true,
    __TEST__: true,
  },
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/kairo',
  coverageReporters: [['lcov', { projectRoot: './' }]],
};
