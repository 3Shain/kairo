
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports =
{
  displayName: 'react-lib',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ["**/*.cm.spec.ts?(x)"],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/react-lib-cm',
  coverageReporters: [['lcov', { projectRoot: './' }]],
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' },
    __DEV__: true,
    __TEST__: true,
  },
  moduleNameMapper: {
    "^react$": "react-experimental",
    "^react-dom$": "react-dom-experimental",
    "^react-dom/test-utils$": "react-dom-experimental/test-utils",
    "^@testing-library/react$": "@testing-library/react-alpha"
  }
};
