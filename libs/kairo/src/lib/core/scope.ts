import { Behavior, ExtractBehaviorProperty } from '../public-api';
import { BloomFilter } from '../utils/bloom-filter';

interface Scope {
    disposers: {
        index: number;
        disposeFn: () => void;
        cancelled: boolean;
    }[];
    sealed: boolean;
    parent: Scope | null;
    root: Scope | null;
    injections: Map<any, any>;
    injection_bloom: BloomFilter;
    disposed: boolean;
}

function createScope<T>(
    fn: () => T,
    parentScope: Scope | null = null,
    rootScope: Scope | null = null
) {
    if (parentScope && !parentScope.sealed) {
        throw Error('Parent scope is not sealed.');
    }
    const scope: Scope = {
        disposers: [],
        sealed: false,
        parent: parentScope,
        root: rootScope ?? parentScope?.root ?? null,
        injections: new Map(),
        injection_bloom: new BloomFilter(
            8,
            4,
            parentScope?.injection_bloom.buckets
        ),
        disposed: false,
    };
    const exposed = scopedWith(fn, scope);
    scope.sealed = true; // WTF
    return {
        scope,
        exposed,
    };
}

function runIfScopeExist(fn: () => void) {
    if (currentScope) {
        fn();
    }
}

// TODO: potential bug: FILO dispose
function registerDisposer(disposer: () => void) {
    const scope = resumeScope();
    const disposeObj = {
        index: scope.disposers.length,
        disposeFn: disposer,
        cancelled: false,
    };
    scope.disposers.push(disposeObj);
    return () => {
        if (disposeObj.cancelled) {
            return;
        }
        disposeObj.cancelled = true;
        const popped = scope.disposers.pop()!;
        if (popped !== disposeObj) {
            scope.disposers[disposeObj.index] = popped;
            popped.index = disposeObj.index;
        }
    };
}

let currentScope: Scope | null = null;

function resumeScope() {
    if (!currentScope) {
        throw Error('Failed to resume current scope.');
    }
    return currentScope;
}

function disposeScope(scope: Scope) {
    if (scope.disposed) {
        return;
    }
    while (scope.disposers.length) {
        const popped = scope.disposers.pop()!;
        popped.cancelled = true;
        popped.disposeFn();
    }
    scope.injections.clear();
    scope.root = null;
    scope.parent = null;
    scope.disposed = true;
}

function unscoped<T>(fn: () => T) {
    const stored = currentScope;
    currentScope = null;
    const ret = fn();
    currentScope = stored;
    return ret;
}

function scopedWith<T>(fn: () => T, scope: Scope) {
    const stored = currentScope;
    currentScope = scope;
    const ret = fn();
    currentScope = stored;
    return ret;
}

class InjectToken<T> {
    constructor(public readonly name: string) {}

    toString() {
        return this.name;
    }
}

interface Factory<T> {
    name: string;
    (...args: any[]): T;
}

type Provider<T> = (
    | {
          useValue: T;
      }
    | {
          useFactory: (...args: []) => T;
          deps?: any[];
      }
    | {
          useAlias: Factory<T> | InjectToken<T>;
      }
) & {
    provide: Factory<T> | InjectToken<T>;
    multi?: boolean;
};

function assertType<T>(value: unknown): value is T {
    return true;
}

function provide<T>(providers: Provider<T>): T;
function provide<T>(factory: Factory<T>, args?: any[]): T;
function provide<T>(provide: InjectToken<T>, value: T): T;
function provide<T>(arg0: any, arg1?: any): any {
    const scope = resumeScope();
    if (scope.sealed) {
        throw Error('Sealed');
    }
    if (arg0 instanceof InjectToken) {
        scope.injection_bloom.add(arg0.name);
        scope.injections.set(arg0, arg1);
        return arg1;
    } else if (typeof arg0 === 'function' && assertType<Factory<any>>(arg0)) {
        const exposed = arg1 != undefined ? arg0(...arg1) : arg0(); //TODO: PBP
        scope.injection_bloom.add(arg0.name);
        scope.injections.set(arg0, exposed);
        return exposed;
    } else if (arg0.provide && assertType<Provider<any>>(arg0)) {
        if ('useAlias' in arg0) {
            const aliased = inject(arg0.useAlias);

            scope.injection_bloom.add(arg0.provide.name);
            scope.injections.set(arg0.provide, aliased);

            return aliased;
        } else if ('useValue' in arg0) {
            scope.injection_bloom.add(arg0.provide.name);
            scope.injections.set(arg0.provide, arg0.useValue);

            return arg0.useValue;
        } else if ('useFactory' in arg0) {
            throw Error('not implemented');
        }
    }
}

function inject<T>(
    fn: Factory<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T;
function inject<T>(
    token: InjectToken<T>,
    options?: {
        optional?: true;
        skipSelf?: boolean;
        defaultValue: T;
    }
): T;
function inject<T>(
    token: InjectToken<T>,
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
    let scope: Scope | null = resumeScope();
    if (options?.skipSelf) {
        scope = scope.parent;
    }
    // get bloom hash
    if (scope?.injection_bloom.test(token.name) === false) {
        // if not exist in bloom filter, directly find in root
        scope = scope.root;
    }
    while (scope !== null) {
        const d = scope.injections.get(token);
        if (d === undefined) {
            scope = scope.parent ?? scope.root;
        } else {
            return d;
        }
    }
    if (options?.optional) {
        return options.defaultValue ?? undefined;
    }
    throw Error(`Injection token '${token.name}' is not found.`);
}

export {
    createScope,
    registerDisposer,
    unscoped,
    scopedWith,
    resumeScope,
    disposeScope,
    inject,
    provide,
    InjectToken,
    runIfScopeExist,
};
export type { Scope, Provider, Factory };
