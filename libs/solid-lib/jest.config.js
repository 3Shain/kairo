module.exports = {
  displayName: 'solid-lib',
  preset: '../../jest.preset.js',
  transformIgnorePatterns: ['node_modules/(?!solid-js.*|.*(?<=.[tj]sx))$'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/solid-lib',
  resolver: './resolver.js',
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.spec.json',
      babelConfig: '<rootDir>/babel.config.js',
      diagnostics: {
        ignoreCodes: [2578],
      },
    },
    __DEV__: true,
    __TEST__: true,
  },
  moduleNameMapper: {
    '^kairo$': '<rootDir>/../kairo/src',
  },
};
