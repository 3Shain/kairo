const preprocess1 = require('../../../dist/libs/svelte-preprocess');
module.exports = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess:
    preprocess1({
      sourceMap: true,
    }),
};
