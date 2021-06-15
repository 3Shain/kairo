const nxPreset = require('@nrwl/jest/preset');

module.exports = {
  ...nxPreset,
  global: {
    __DEV__: true,
    __TEST__: true,
  },
};
