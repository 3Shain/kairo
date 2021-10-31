
const sveltePreprocess = require('../../dist/libs/svelte-preprocess');
module.exports = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    sveltePreprocess({
     sourceMap: true
    }),
  ],
};
