module.exports = {
  displayName: 'react-app',
  preset: '../../jest.preset.js',
  transform: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/react-app',
};
