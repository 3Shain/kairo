import { CancellablePromise } from './concurrency';
import { Cleanable } from './types';
import { doCleanup, noop } from './utils';
import { BloomFilter } from './utils/bloom-filter';

type OnMountLogic = () => Cleanable;

/**
 * The dirtiest part of kairo (the second is concurrency...)
 * The bloomfilter process is inspired by Angular.
 */

class Scope {
  private onmountLogics: OnMountLogic[] = [];
  private injections: Map<object, any> = new Map();
  private injections_bloom: BloomFilter;

  constructor(
    public readonly parentScope?: Scope,
    public readonly rootScope?: Scope
  ) {
    this.injections_bloom = new BloomFilter(
      8,
      4,
      parentScope?.injections_bloom.buckets
    );
    this.rootScope = rootScope ?? parentScope?.rootScope;
  }

  beginScope() {
    const stored = Scope._currentScope;
    Scope._currentScope = this;
    return () => {
      Scope._currentScope = stored;
    };
  }

  private static _currentScope: Scope | null = null;
  static get current() {
    if (Scope._currentScope) {
      return Scope._currentScope;
    }
    /* istanbul ignore next */
    throw new TypeError('Not inside a scope.');
  }

  registerOnMountLogic(logic: OnMountLogic) {
    /* istanbul ignore if */
    if (this !== Scope.current) {
      throw new TypeError('Invalid opearation');
    }
    this.onmountLogics.push(logic);
  }

  registerProvider(arg0: any, arg1?: any, ...args: any[]): any {
    /* istanbul ignore if */
    if (this !== Scope.current) {
      throw new TypeError('Invalid opearation');
    }
    if (arg0 instanceof Token) {
      this.injections_bloom.add(arg0.name);
      this.injections.set(arg0, arg1);
      return arg1;
    } else if (typeof arg0 === 'function' && assertType<Factory<any>>(arg0)) {
      const exposed = arg0(arg1, ...args);
      this.injections_bloom.add(arg0.name);
      this.injections.set(arg0, exposed);
      return exposed;
    }
  }

  inject(
    token: {
      name: string;
    },
    options?: any
  ): any {
    let scope: Scope | undefined = this;
    if (options?.skipSelf) {
      scope = scope.parentScope ?? scope.rootScope; // in case current scope is top
    }
    // get bloom hash
    if (scope?.injections_bloom.test(token.name) === false) {
      // if not exist in bloom filter, directly find in root
      scope = scope.rootScope;
    }
    while (scope) {
      const d = scope.injections.get(token);
      if (d === undefined) {
        scope = scope.parentScope ?? scope.rootScope;
      } else {
        return d;
      }
    }
    if (options?.optional) {
      return options.defaultValue ?? undefined;
    }
    throw Error(`Injection token '${token.name}' is not found.`);
  }

  private attached = false;
  attach() {
    /* istanbul ignore if */
    if (this.attached) {
      throw TypeError('Scope has been attached');
    }
    this.attached = true;
    const cleanups = this.onmountLogics.map((x) => {
      const cleanup = x();
      if (cleanup instanceof CancellablePromise) {
        cleanup.catch(noop); // to avoid unhandled promise rejection
      }
      return cleanup;
    });
    return () => {
      this.attached = false;
      cleanups.forEach(doCleanup);
    };
  }
}

function mount(onmount: OnMountLogic) {
  Scope.current.registerOnMountLogic(onmount);
}

class Token<T> {
  constructor(public readonly name: string) {}

  static for<T>(name: string) {
    return new Token<T>(name);
  }

  /* istanbul ignore next */
  toString() {
    return this.name;
  }
}

interface Factory<T> {
  name: string;
  (...args: any[]): T;
}

function assertType<T>(value: unknown): value is T {
  return true;
}

function provide<T>(factory: Factory<T>, ...args: Parameters<Factory<T>>): T;
function provide<T>(provide: Token<T>, value: T): T;
function provide<T>(arg0: any, ...arg1: any[]): any {
  return Scope.current.registerProvider(arg0, ...arg1);
}

function inject<T>(
  fn: Factory<T>,
  options?: {
    optional?: boolean;
    skipSelf?: boolean;
  }
): T;
function inject<T>(
  token: Token<T>,
  options?: {
    optional?: true;
    skipSelf?: boolean;
    defaultValue: T;
  }
): T;
function inject<T>(
  token: Token<T>,
  options?: {
    optional?: boolean;
    skipSelf?: boolean;
  }
): T;
function inject(
  token: {
    name: string;
  },
  options?: any
): any {
  return Scope.current.inject(token, options);
}

export { inject, provide, mount, Token, Scope, Factory };
