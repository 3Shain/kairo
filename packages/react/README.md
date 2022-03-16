# @kairo/react

React integration for kairo.

## Installation

```sh
npm i kairo @kairo/react

# or yarn
yarn add kairo @kairo/react
```

## Usage


### You can still use Hooks

Kairo is an addition, not a whole replacement

Generally you don't need these Hooks anymore
* `useRef`: You already have access to the setup context closure, and their references are stable. For view element reference, there are `ref` to instead.
  > But you should really be careful
* `useCallback`: the same reason above
* `useMemo`: the same reason above
<!-- * `useEffect`: You have `lifecycle` for lifecycle and `effect` for side effects. -->
* `useContext`: Use kairo's DI whenever possible

But you may still need these:
* `useLayoutEffect`: To manage view-related side effect
* Concurrent Features

## Caveats

