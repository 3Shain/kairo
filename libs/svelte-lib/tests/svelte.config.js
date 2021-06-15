const sveltePreprocess = require('svelte-preprocess');
const { kairo } = require('../transformer');
module.exports = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    sveltePreprocess({
      babel: kairo({
        sourceMaps: 'inline',
      }),
      sourceMap: true,
    }),
  ],
};
