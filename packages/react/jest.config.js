
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports =
{
  displayName: 'react-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ["**/*.spec.ts?(x)", "!**/*.cm.spec.ts?(x)"],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/react-lib',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
    __DEV__: true,
    __TEST__: true,
  },
};
