module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          chrome: 74,
        },
      },
    ],
  ],
  plugins: [
    '@babel/plugin-transform-runtime' /* I DONT WANT THIS STUPID THING. GENERATOR JUST WORKS EVERYWHERE 🤮...
    but without this I always got ReferenceError: regeneratorRuntime is not defined
    I do not need this polyfill at all but no matter how I modify the configuration
    it just does not work. I guess it's ts-jest not respecting this... */,
    '@vue/babel-plugin-jsx',
  ],
};
