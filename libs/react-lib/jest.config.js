module.exports = {
  displayName: 'react-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/react-lib',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  coverageProvider: 'v8',
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
    __DEV__: true,
    __TEST__: true,
  },
};
