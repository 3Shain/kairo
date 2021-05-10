# Kairo.js

![](https://img.shields.io/npm/l/kairo) ![npm version](https://img.shields.io/npm/v/kairo) ![discord](https://img.shields.io/discord/759760966191153192)

## ☝️ Kairo is

### a set of APIs as well as **_a refinement of the reactive programming paradigm._**.

_Kairo is currently designed for frontend applications, but there are still a lot to investigate!_

## ✌️ Kairo has

Three primitives, with some helper functions.

## 👌 Kairo provides

-   An architecture and abstraction of reactive frontend app at an application- as well as component-level.
-   **Simple mental model** and **Great readability** of asynchronous programming.
-   Logic composition & reuse.
-   IoC with Dependency injection.
-   State Management.
-   All features above is avaliable **ACROSS FRAMEWORKS/UI LIBRARIES**.
    > Currently react, angular, solid, svelte and vue integrations are provided.

## Basic Idea

We introduce **reactive programming** for two things: **small changes can make big effects** and **schedule things to happen in order**. Let's think of dominoes: When the first tile is toppled, it topples the second, which topples the third, etc., resulting in all of the tiles fallin; And all tile fall in a predictable order. So when we write a reactive program, we will have a similar experience: we assign a variable, then the view is changed consequently; The second point is usually achived by abstraction of declarative data-stream (like ReactiveX), or isn't a problem in imperative codes as order is guaranteed. With this definition in mind, I wrote this library `kairo`, refined most important ideas of 'reactive' in practical application, to provide you with an easy-to-use tool to write robust and maintainable reactive applications.

## Primitive#1 **Behavior**

```ts
import { mut } from 'kairo';

const [count, setCount] = mut(0);
// `count` is a Behavior<number> object, `setCount` is a function.

const snap = count.value; // read
setCount(1); // mutate
```

**Behavior** stores a varying value. We can access the value by `.value`. By `mut(initialValue)` we can create a Behavior that is mutable.

**There are reasons to read by getter and write by a separate function**

-   It doesn't break javascript semantics. Read is still read but mutating a data is not the same and shouldn't be treated as object property assignment.
-   It enforces uni-direction data-flow: you can mutate data only if you have the setter. (And usually you shouldn't expose it, keep it _private_)
-   With a `.value` getter, you know you are accessing a Behavior. Thus you know which part of your code is going to 'react'. (While the code is still readable, it increases maintainability a lot!)

**But keep in mind, not all Behavior is mutable. By definition Behavior just store a varying value.**

Behaviors can derive Behaviors, this is called Computation.

```ts
const doubled = computed(() => count.value * 2); // create by a thunk.
// FP fashion
const doubled = count.map((x) => x * 2);
```

Computation can depend on multiple behaviors, but be careful with circular dependency!

```ts
const sum = computed(()=>a.value + b.value); // computed receives a thunk.
// FP fashion
const sum = combined([a,b]).map(Math.sum);
// actually there is not such `Math.sum` ... but you know what I mean

const c = computed(()=> ... c.value ...); // never do this!
```

Computation can be dynamic (use logic flow statements), but it should be always `pure`.

```ts
const a = computed(() => {
    return b.value ? c.value : d.value;
    // as well as if/for/while etc. is usable (but you probably don't need them all.)
});
// FP fashion
const a = b.switch((x) => (x ? c : d));
```

Pure means you can only read but not mutate Behavior, and you shouldn't raise any side effects (Because the execution time is never guaranteed, _but the relationship between Behaviors is_).

Computation defines a strict relationship of behaviors, and this relationship holds **at any time you access them**. But wouldn't this be inefficient? Well that's too complicated to explain here but the short anwser is: kairo knows the best time to update values and it is in fact super performant. One of the secrets is to know if a Behavior is _effective_: it will raise side effects when its value changed.

Let's return to the basic idea of reactive. We now have data and data depend on data......but it is meaningless if our data don't do some real effects, i.e. update our views, or send a http request, etc. So we need to _bind_ our Behavior to something in some way, and actually the integrations of kairo for many frameworks/libraries do this job in a really sophisticated way. (You will see more about this below). Anyway, there is a simplest way to make a Behavior _effective_: `.watch(watcherFn)`

```ts
const stopWatchHandler = count.watch((current) => {
    console.log(`current value is ${current}`); // log is a typical side effect
    // and you can e.g. mutate DOM element, but with a nice framework integration you will rarely do this.
});

// at some point, stop watching
stopWatchHandler();

/**
 * This is an example of React integration, no need to .watch()
 *
 * Funny fact: the code below will function well with no error
 * in Vue & Solid with respective integrations
 * by just copy&paste!
 */
const Counter = withKairo(() => {
    const [count, setCount] = mutable(0);
    return () => (
        <>
            <span>{count.value}</span>
            <button onClick={() => setCount(count.value + 1)}>Click me!</button>
        </>
    );
});
```

You are not recommended to mutate Behavior in `.watch()`. The reason is super simple: A mutation causes consequential computations and (synchronous) side effects. If you do another mutation inside computations or (synchronous) side effects then a loop might come up, which makes things **hard to predict**. In most case, you can use `computed()` instead of you want to mutate a Behavior after another Behavior changes.

## Primitive#2 **EventStream**

It's known we can mutate Behaviors almost everywhere, but to be exact we only mutate Behavior when an event occur. This doesn't mean we can only mutate Behaviors in event because event is a very abstract concepts. The fact is where we mutate Behaviors **is** inside an event, it could be an actual DOM event like `onclick`,`onmessage`,etc, or something we've defined at some level of abstraction like `onUserLogin`,`onLimitExceed`. Regardless you will mutate Behaviors in a meanful context, thus we generally say: **Event mutates Behaviors** (and Behaviors cause side effects). Congrats! We have seen the backbone of the (kairo) reactive pattern.

**EventStream** is an object representing the future occurrences of an event. It is a quite abstract concept, and I've tried to make it look like an isomorphism of Behavior (but it isn't!).

```ts
const [plusEvent, plus] = stream<number>();
// `plusEvent` is an EventStream<number> object, `plus` is a function.
```

By `stream()` we can create an EventStream that is emittable.

**But keep in mind, not all EventStream is emittable. By definition EventStream only stands for the future occurrences of an event.**

EventStream can derive EventStream.

```ts
const dataStream = event.transform((x) => x.data);
/**
 * just like Behavior.map
 * the reason for a different name is:
 * map is valid all the time,
 * but transform happens at a perticular time.
 */

const notNullStream = event.filter((x) => x != null);
/**
 * filter receive a function returning bool value
 * and only 'true' payloads are emitted.
 */
```

<!--
Schedule is a kind of derivation that make an occurance of event filtered or delayed asynchronously. It receives a scheduler.

```ts
const debounceStream = event.schedule(debounce(100)); //
```

There are some built in schedulers:

-   `asap`: Emit event in next microtask.
-   `async`: Emit event in next microtask.
-   `animation`: Emit event in next requestAnimationFrame call.
-   `debounce(time)`
-   `threshold(time)` -->

EventStreams can be `merged` into an EventStream, just like you can combine Behaviors

```ts
const mergedStream = merged([eventA, eventB, eventC]);
```

EventStream can be `reduced` or `held` to become a Behavior

```ts
const [plusEvent, plus] = stream<number>();

const count = reduced(plusEvent, (a, b) => a + b, 0);

const lastEvent = held(plusEvent, 0);
```
<!-- 
And Behavior `.changes(scheduler)` can gives an EventStream, but you must provide a `Scheduler`, -->

Like Behavior can be `watch`ed, you can `listen` an EventStream.

Here is a table comparing the conceps of Behavior and EventStream

|               | Behavior                        | EventStream                    |
| ------------- | ------------------------------- | ------------------------------ |
| definition    | a varying value                 | future occurrences of an event |
| the 'atom'    | mut(`initial`)                  | stream()                       |
| derivation    | .map() / .switch() / computed() | .transform() / .filter() /     |
| composition   | combined()                      | merged()                       |
| notification  | .watch()                        | .listen()                      |
| 'placeholder' | constant(value)                 | never()                        |
| convert       | N/A                             | reduced() / held()             |

## Primitive#3 **Task**

Now you can already build a reactive system using Behavior & EventStream. They are both declarative (describe the data flow than mutate/transport data directly) and predictable (given initial state and steps of event, we get the current state).

Recall our basic idea of 'reactive' again. The first point is already brought by Behavior and EventStream, but how about the second point: schedule things to happen **in order**? To make it clear, we are going to make a [konami code](https://en.wikipedia.org/wiki/Konami_Code) as an example: press the keys in order to `activate a cheat`. It seems Behavior and EventStream are not very handy tools to solve this problem, at least we need extra states to model it. Is there any intuitive way to solve this? The third primitive: Task is introduced.

Task is based on generator function of ES6, and have a similar syntax with async/await. The differences expect for syntax are that Task is cancellable, and it has its own schedule strategy (other than microtasks). Task can solve the example above is because it is imperative, and imperative guarantees order in natural. (Later I will show a gist for this)

Writing a task is almost the same as writing an ordinary function, and the main differences is:

1. There must be an asterisk(\*) after the keyword `function`
2. There is a new statement `yield* <expression>`
3. Wrapped by `task()` (or derivations of it)

> NB: It is `yield*` ,not `yield`. This is for better TypeScript support and avoid confusion. One simple rule, use `yield*`!

Thle `yield*` statement yields an object whose value is not available at present but sometimes in the future. Thus we can yield an EventStream to get _the event data of next occurrence_.

```ts
import { task } from 'kairo';

const startTask = task(function* () {
    const data = yield* eventStream;
});

const taskObject = startTask(); // invoke the task
// taskObject is a Promise with a `cancel()` method
taskObject.cancel();

// It's different from calling an ordinary generator function: the logic executes immediatly, like async function.
```

You can yield a Promise or [Observable](https://github.com/tc39/proposal-observable) by `resolve()`

```ts
import { task, resolve } from 'kairo';

const startTask = task(function* () {
    const body = yield* resolve(
        fetch('https://api.github.com/').then((x) => x.text())
    );

    /* https://github.com/tc39/proposal-observable
     * It only returns the last value (before complete), like AsyncSubject
     */
    const last = yield* resolve(observable);
});
```

<!--
Or you can use callback. It looks like constructing a Promise, but you can return a function which will be called when the excuting task is cancelled.

```ts
import { task, callback, delay } from 'kairo';

const startTask = task(function* () {
    // delay 500ms
    yield* callback((resolve, reject) => {
        const id = setTimeout(() => {
            resolve();
        }, 500);
        return () => clearTimeout(id); // dispose logic! remenber task is cancellable!
    });

    // to make a delay you can simply use the helper function
    yield* delay(500);
    // or use timeout, the difference is timeout raise an error
    yield* timeout(500);
});
``` -->

Task itself is yield\*able as well.

```ts
const startTask1 = task(...);

const startTask2 = task(function*(
    parameter1:number,
    parameter2:string
    /** you can declare parameters as well  */
) {
    const value = yield* startTask1(); // you can get the return value of a task

    ...

    yield* startTask2(0,'a string'); // and pass parameters like normal function call
});
```

### Error handling

Just use try-catch.

As Task is cancellable, a `yield*` statement will throw an `CanceledError`, so that you can get notified and do cleanup logics.

```ts

import { task, CanceledError } from 'kairo';

task(function*(){
    try{
        ... // your logics
    } catch(e) {
        if(e instanceof CanceledError){
            // do cleanup logics
        } else {
            // handle errors
        }
    }
});
```

### Concurrency

We have four functions to deal with concurency, they all receives an array of yield\*able expression;

| Function            | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `all([...])`        | When all tasks success. It will throw if any task throw.              |
| `allSettled([...])` | When all tasks settled. It will throw if all tasks throw.             |
| `race([...])`       | When any task settled. It will throw if the first settled task throw. |
| `any([...])`        | When any task success. It will throw if all tasks throw.              |

### `readEvents()`

Sometimes you need a sequence of event occurance other than single one (e.g. Drag-and-drop is basicly a sequence of mousemove). There is a helper function for this.

```ts
task(function*(){

    const channel = readEvents({
        from: eventStream1
        until: eventStream2
    });

    while(yield* channel.hasNext()){
        const next = yield* channel.next();
    }

    // or use try-catch fashion
    while(true){
        let next;
        try {
            next = yield* channel.next();
        } catch {
            // channel stoped.
        }
    }
})

```

### Gist: konami code

```ts
function useKonami(keys: string[]) {
    const [keydown, emitkey] = stream<KeyboardEvent>();

    const keydownCode = keydown.transform((x) => x.code);

    const startTask = task(function* () {
        while (true) {
            const key = yield* keydownCode;
            if (key == keys[0]) {
                const keysRemain = keys.slice(1).reverse();
                while (keysRemain.length) {
                    const next = yield* race([keydownCode, delay(1000)]);
                    if (next !== keysRemain.pop()) {
                        console.log('failed');
                        break;
                    }
                    if (keysRemain.length == 0) {
                        console.log('activated!');
                    }
                }
            }
        }
    });

    effect(() => {
        window.addEventListener('keydown', emitkey);
        return () => window.removeEventListener('keydown', emitkey);
    });

    effect(() => startTask());
}

useKonami([
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
]);
```

## Scope

Scope is introduced to manage side effects. 

<!-- If you don't know what is side effect, there is a very interesting definition: the code can be executed multiple times at any time with no issues. Let's give some example:
* A function calculate the sum of two number : no side effect.
* A function that will change the title of window : there is side effect
* A function will watch ...
* ... -->

`effect` is used in a gist above but doesn't introduced yet, it shows how kairo manages side effects. `effect(sideEffect)` receives a function that will be executed when kairo think it's time to do side effect (e.g. A component mounted) and this function can return a function that will be executed when kairo decided to do cleanups. A Scope usually attaches to an outside world object such as a Component (of a front-end frameworks).

Scopes can have a hierarchy, just like we usually model application as a tree of component. A Scope has a parent Scope, and a Scope is always initialize after and dispose before its parent Scope. There is a root Scope, and it might attach to the whole application.

Because Scopes have a hierarchy, thus its suitable and reasonable to have a dependency injection mechanism. Parent Scope can `provide()` something and children Scope can `inject()`.

```ts

import { provide, inject, Token } from 'kairo';

const THE_TOKEN = Token.for<Type>('A unique name');

// In parent Scope

const theObject = ...; // the object you want to provide

provide(THE_TOKEN,theObject);

// In children Scope

const theObject = inject(THE_TOKEN);

```

Besides `Token` object, a function can be also treat as a token, such that we call this function a Service.

```ts
function FooService() {
    // declear your Behaviors, EventStream as well as Task here

    return {
        // and expose them in an object literal
    };
}

// In parent Scope
const foo = provide(FooService);
// the function is eager-executed and the return value is provided to children scope.

// In children Scope

const foo = inject(FooService);
// now you can access the object exposed.
```

But how can I create a Scope? Well this should be done by integrations already, but you can still check the documentation.


## Integrations

Now you can get start with one of your familiar frameworks. With these integrations the DX is maximized.

| Package                                                               | Version                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| [Angular](https://github.com/3shain/kairo/tree/master/libs/ng-lib)    | ![npm version](https://img.shields.io/npm/v/@kairo/angular) |
| [React](https://github.com/3shain/kairo/tree/master/libs/react-lib)   | ![npm version](https://img.shields.io/npm/v/@kairo/react)   |
| [Solid](https://github.com/3shain/kairo/tree/master/libs/solid-lib)   | ![npm version](https://img.shields.io/npm/v/@kairo/solid)   |
| [Svelte](https://github.com/3shain/kairo/tree/master/libs/svelte-lib) | ![npm version](https://img.shields.io/npm/v/@kairo/svelte)  |
| [Vue](https://github.com/3shain/kairo/tree/master/libs/vue-lib)       | ![npm version](https://img.shields.io/npm/v/@kairo/vue)     |

## Documentation(TBD)

-   Behavior related
-   EventStreams related
-   Task related
-   Scope related

> Most features has been introduced in this README, the document will add some specifications. I will be on discord (see below) if you're unclear about something. You can also post it on github Discussion.

## Todos

-   Full API Documentation
-   Common interface of common features (like ajax, frontend-routing, webapi)
-   A tutorial about debug.
-   Unit tests

## Credit

-   **Functional Reactive Programming** : Where the concepts of Behavior and EventStream come from.
-   [RxJS](https://github.com/ReactiveX/rxjs): Another good model of async programming based on observer pattern
-   [S.js](https://github.com/adamhaile/S): Provides such a performant implementation of reactive mechanism. And Kairo was initial based on it, and brought more optimizations.
-   [Vue composition api](https://github.com/vuejs/vue-next): The idea of composition.
-   [Angular](https://github.com/angular/angular): Brings a good structure of web application.
-   [ember-concurrency]() Where my thoughts about `task` comes from
-   [MobX]() More or less gives me some inspiration of API designing

## Community

Currently I've hosted a [Discord](https://discord.gg/pDkYpa6Mxu) server. Feel free to chat.

## License

MIT License © 2021 3Shain [san3shain@gmail.com](mailto:san3shain@gmail.com)
