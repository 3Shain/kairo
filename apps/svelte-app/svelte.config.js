const sveltePreprocess = require('svelte-preprocess');
const { kairo } = require('../../libs/svelte-lib/transformer');
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
