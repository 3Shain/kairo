
const sveltePreprocess = require('../../dist/packages/svelte-preprocess');
module.exports = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    sveltePreprocess({
     sourceMap: true
    }),
  ],
};
