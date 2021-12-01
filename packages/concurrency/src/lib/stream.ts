import type { RunnableGenerator } from './types';
import {
  Cleanable,
  TeardownLogic,
  doCleanup,
  identity,
  mut,
  lifecycle,
} from 'kairo';
import { __fulfill, TaskSuspended } from './task';

interface SubscriptionNode {
  next: SubscriptionNode | null;
  prev: SubscriptionNode | null;
  handler: Function;
}

export class EventStream<T> {
  /** @internal */
  constructor(private producer: (next: (value: T) => void) => Cleanable) {}

  *[Symbol.iterator](): RunnableGenerator<T> {
    return yield (next) => {
      const unsub = this.listen((value) => {
        next(__fulfill(value));
        unsub(); //
      });
      throw new TaskSuspended(unsub);
    };
  }

  private disposeProducer: Cleanable | null = null;

  private head: SubscriptionNode | null = null;
  private tail: SubscriptionNode | null = null;
  private propagating = false;

  private __internal_subscribe(handler: (value: T) => void) {
    const node: SubscriptionNode = {
      next: null,
      prev: this.tail,
      handler: handler,
    };
    if (!this.head) {
      this.head = node;
      this.tail = node;
      // activate
      this.disposeProducer = this.producer((s) => this.next(s));
    } else {
      this.tail!.next = node;
      this.tail = node;
    }
    const subscription = () => {
      if (node.prev) {
        //node is head
        node.prev.next = node.next;
      } else {
        this.head = node.next;
      }
      if (node.next) {
        //node is tail
        node.next.prev = node.prev;
      } else {
        this.tail = node.prev;
      }
      if (!this.head) {
        // deactivate
        doCleanup(this.disposeProducer!);
      }
    };
    return subscription;
  }

  private next(value: T) {
    if (this.propagating) {
      console.error(`A loop occured.`); // TODO: detailed error message.
      return;
    }
    this.propagating = true;
    let p = this.head;
    const handlers: Function[] = [];
    while (p !== null) {
      handlers.push(p.handler);
      p = p.next;
    }
    // linked list is mutable data structure thus a immutable snapshot of subscriptions is required.
    // then you can subscribe or unsubscirbe inside a handler.
    while (handlers.length) {
      handlers.pop()!(value);
    }
    this.propagating = false;
  }

  /** @internal */
  listen(handler: (value: T) => Cleanable): TeardownLogic {
    let lastDisposer: Cleanable = undefined;
    const unsubscribe = this.__internal_subscribe((value) => {
      doCleanup(lastDisposer);
      lastDisposer = handler(value);
    });
    return () => {
      doCleanup(lastDisposer);
      unsubscribe();
    };
  }

  transform<R>(transformFn: (value: T) => R) {
    return new EventStream<R>((next) => {
      return this.__internal_subscribe((v) => next(transformFn(v)));
    });
  }

  select(filterFn: (value: T) => boolean) {
    return new EventStream<T>((next) => {
      return this.__internal_subscribe((v) => {
        if (filterFn(v)) {
          next(v);
        }
      });
    });
  }

  static create<T, S = T>(
    transformer: (value: S) => T = identity as any
  ): [EventStream<T>, (payload: S) => void] {
    const stream = new EventStream<T>(() => {
      return () => {};
    });
    return [stream, (payload: S) => stream.next(transformer(payload))];
  }
}

export function stream<T = any, S = T>(
  transformer: (value: S) => T = identity as any
) {
  return EventStream.create<T, S>(transformer);
}

type ExtractEventStream<T> = {
  [P in keyof T]: T[P] extends EventStream<infer C> ? C : unknown;
};

export function merged<A extends Array<EventStream<any>>>(
  array: A
): EventStream<ExtractEventStream<A>[number]> {
  return new EventStream((next) => {
    const listeners = array.map((stream) => stream.listen(next));
    return () => listeners.forEach((x) => x());
  });
}

// istanbul ignore next: simple composite
export function reduced<T, E>(
  event: EventStream<E>,
  reducer: (current: T, event: E) => T,
  initial: T
) {
  const [state, update] = mut(initial);
  lifecycle(() => event.listen((value) => update((e) => reducer(e, value))));
  return state;
}

// istanbul ignore next: simple composite
export function held<T>(event: EventStream<T>, initial: T) {
  return reduced(event, (_, e) => e, initial);
}
