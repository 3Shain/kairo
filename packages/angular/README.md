# @kairo/angular

Angular (Ivy) integration for kairo.

## Installation

```sh
yarn add @kairo/angular kairo

# or use npm
npm install @kairo/angular kairo
```

## Basic Usages

Add decorator above `Component` or `Directive`

```ts

@WithKairo()
@Component({
  selector: ``,
  template: `<div></div>`,
})
export class DemoComponent extends ngSetup(()=>{

}) { } // be careful ending brackets!
```

