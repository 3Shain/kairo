const preprocess1 = require('../../../dist/packages/svelte-preprocess');
module.exports = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess:
    preprocess1({
      sourceMap: true,
    }),
};
