import { TeardownLogic } from "../types";

const yielda = Symbol('yield');

export declare interface TaskYieldable {
    readonly [yielda]: unique symbol;
}

export type TaskFunction<T> = (...args: any[]) => Generator<TaskYieldable, T>;

export type Task<T> = Generator<any, T, any>

export type Execute = (resolve: any, reject: any) => TeardownLogic | void;

export interface YieldExectuable {
    execute: Execute;
}

export interface ReadableChannel<T> {
    next(): Task<T>;
    hasNext(): Task<boolean>;
}

/// Not yet ready, too advanced.
export interface WriteableChannel<T> {

}

/**
 * Observable type definations
 */
export declare type InteropObservable<T> = {
    [Symbol.observable]: () => Subscribable<T>;
};
export interface Subscribable<T> {
    subscribe(observer?: PartialObserver<T>): Unsubscribable;
    /** @deprecated Use an observer instead of a complete callback */
    subscribe(next: null | undefined, error: null | undefined, complete: () => void): Unsubscribable;
    /** @deprecated Use an observer instead of an error callback */
    subscribe(next: null | undefined, error: (error: any) => void, complete?: () => void): Unsubscribable;
    /** @deprecated Use an observer instead of a complete callback */
    subscribe(next: (value: T) => void, error: null | undefined, complete: () => void): Unsubscribable;
    subscribe(next?: (value: T) => void, error?: (error: any) => void, complete?: () => void): Unsubscribable;
}
export interface Unsubscribable {
    unsubscribe(): void;
}
export interface NextObserver<T> {
    closed?: boolean;
    next: (value: T) => void;
    error?: (err: any) => void;
    complete?: () => void;
}
export interface ErrorObserver<T> {
    closed?: boolean;
    next?: (value: T) => void;
    error: (err: any) => void;
    complete?: () => void;
}
export interface CompletionObserver<T> {
    closed?: boolean;
    next?: (value: T) => void;
    error?: (err: any) => void;
    complete: () => void;
}
export declare type PartialObserver<T> = NextObserver<T> | ErrorObserver<T> | CompletionObserver<T>;