import { Plugin as Plugin_, TransformResult } from 'vite';
import vuePlugin from '@vitejs/plugin-vue';
import type { Options } from '@vitejs/plugin-vue';
import { transform } from '@kairo/vue-sfc-transformer'; // not tsconfig paths but real package.

export default function kairoVuePlugin(rawOptions?: Options): Plugin_ {
  const instance = vuePlugin(rawOptions);
  return {
    ...instance,
    // name: 'vite:kairo-vue-sfc-transformer',
    async transform(inputCode, id, ssr) {
      const ret = instance.transform.call(this, inputCode, id, ssr) as
        | TransformResult
        | Promise<TransformResult>;
      const result = ret instanceof Promise ? await ret : ret;

      if (id.endsWith('.vue')) {
        // I hope this works.
        if (/<script( (.*?) | )kairo(>| (.*?)>)/.test(inputCode)) {
          // it is kairo component
          // @ts-ignore : number -> 3
          return transform(result.code, result.map);
        }
      }

      return result;
    },
  };
}

module.exports = kairoVuePlugin;
kairoVuePlugin['default'] = kairoVuePlugin;
