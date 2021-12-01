# @kairo/vue

Vue integration for kairo.

> Currently for vue version >=3.2, but there should be no technical difficulty to provide support vue 2 (but might be time-consuming). Pull requests are always welcomed.

## Install

```sh
yarn add @kairo/vue kairo

# or use npm
npm install @kairo/vue kairo
```

Then add the types in `tsconfig.json` (or `jsconfig.json`)

```json
{
  "compilerOptions": {
    "types": ["@kairo/vue/interop"]
  }
}
```

Finally
```ts
import { setupVueIntegration } from '@kairo/vue';

// call this _before_ `createApp()`
setupVueIntegration();

createApp(YourApp).mount('#your-container');
```