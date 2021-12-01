# Development

This repository is a (nx) monorepo that contains the following npm packages:

* Features
    * [kairo](packages/kairo): the core library
    * [concurrency](packages/concurrency) the concurrency extension
    * [router](packages/router) 
* Integrations
    * [react](packages/react)
    * [angular](packages/angular)
    * [vue](packags/vue) Note: it's for vue 3
    * [svelte](packages/svelte)
    * [solid](packages/solid)
    * [preact](packages/preact)
* Dev dependencies
    * [vue-sfc-transformer](packages/vue-sfc-transformer): Make kairo work in vue sfc with no effort
    * [vite-vue-plugin](packages/vite-plugin-vue): Hooking `@vitejs/plugin-vue`
    * [svelte-preprocessor](packages/svelte-preprocess): Make kairo work in svelte with no effort (by hooking `svelte-preprocess`)

They are all in the `packages` folder

## Package Manager

We use `yarn` as the package manager. If you add or remove dependencies, please make sure the `yarn.lock` file is up-to-date.

Remember to run `yarn install` after every sync from remote and at the first clone.

## Testing

Simply use `nx test [package-name]`. We use `jest` as testing framework.

Some packages have more than one test preset
* react: `nx run react:test-cm` for testing react integeration with concurrent features
* svelte: `nx run svelte:test-ssr` for testing svelte integration in ssr mode

### Playgrounds

They are in `fixtures` folder. Use `nx serve [name]` to start dev server.

__Do not commit any changes inside this folder__ unless it's intentional (e.g. update dependencies;solve breaking changes).

### Build

Before submitting a pull request, make sure the package can be built without error
```sh
npm run build-tools
nx build [package-name]
```

The bundling script is in [/tools/executors/rollup](/tools/executors/rollup)

## Commit style guide

See [Conventional Commits](https://www.conventionalcommits.org/)

## Side notes

* To test svelte, you should build svelte-preprocess first. `nx build svelte-preprocess`
* Visual Studio Code is recommanded.
    * Use `Volar` to get `.vue` IntelliSense features
