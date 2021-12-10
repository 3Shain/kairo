# Kairo.js

![](https://img.shields.io/npm/l/kairo) 
[![npm version](https://img.shields.io/npm/v/kairo)](https://www.npmjs.com/package/kairo)
[![discord](https://img.shields.io/discord/759760966191153192)](https://discord.gg/pDkYpa6Mxu)
[![Coverage Status](https://coveralls.io/repos/github/3Shain/kairo/badge.svg?branch=master)](https://coveralls.io/github/3Shain/kairo?branch=master)

> This project is currently in the alpha phase.

## Overview

__Kairo__ is a framework-agnostic (stateful) logic composition library. 

To create a web application with kairo, you need to pick up a UI framework. 

Currently supported frameworks:

* [Angular 11+](https://github.com/3Shain/kairo/tree/master/packages/angular)
* [Vue 3.2+](https://github.com/3Shain/kairo/tree/master/packages/vue)
* [React 16.8+](https://github.com/3Shain/kairo/tree/master/packages/react)
* [Preact X+](https://github.com/3Shain/kairo/tree/master/packages/preact)
* [Svelte 3](https://github.com/3Shain/kairo/tree/master/packages/svelte)
* [Solid](https://github.com/3Shain/kairo/tree/master/packages/solid)

## How is this project going?

It has been iterating for a year and so far it is __a well-designed PoC__ in certain degree.
We (to be accurate, I, the repo owner) do encounter several difficulties.
* Designing a non-leaky abstraction needs massive knowledge of various frameworks.
* "Black magics" are required to provide good ergonomics.
* To create future-proof primitives, we need to dig deeper into the theory.
* But the theory and the practice can be misaligned (memory is limited and computation has a overhead). Finding trade-offs is not a good experience.
* Solve existing issues but not create new one.

It's worth a couple of articles to explain these in detail (and once I can't make any progress, I definitely will)

At present __the whole project is usable__, including the core and all framework integrations, but it's not the ultimate version that I expected (that's why I haven't release a formal document. Once I found a concept hard to explain, I will end up realizing something is wrong.). If you are interested in it, please keep an eye on it. __If you have time, I'm finding people to collaborate with me,__ and I'm willing to share all my knowledges.

## Resources

We are heavily working on the document at present 💪. 
## Community

Join our [discord](https://discord.gg/pDkYpa6Mxu) server for the latest news. Also you're welcomed to provide feedback, or suggestions.


## Credits

See [CREDITS](CREDITS.md)