

// export type EventToEventOperator<T, R> = (source: EventStream<T>) => EventStream<R>;

// export type BehaviorToBehaviorOperator<T, R> = (source: Behavior<T>) => Behavior<R>;

// export type EventToBehaviorOperator<T, R> = (source: EventStream<T>) => Behavior<R>;

// export type BehaviorToEventOperator<T, R> = (source: Behavior<T>) => EventStream<R>;

// export type Operator<T, R> = (source: T) => R;

// export interface EventStream<T = any> {

//     pipe<T1, T2, T3, T4, T5, T6, T7, T8, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, T6>, op7: Operator<T6, T7>, op8: Operator<T7, T8>, op9: Operator<T8, R>): R
//     pipe<T1, T2, T3, T4, T5, T6, T7, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, T6>, op7: Operator<T6, T7>, op8: Operator<T7, R>): R
//     pipe<T1, T2, T3, T4, T5, T6, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, T6>, op7: Operator<T6, R>): R
//     pipe<T1, T2, T3, T4, T5, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, R>): R
//     pipe<T1, T2, T3, T4, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, R>): R
//     pipe<T1, T2, T3, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, R>): R
//     pipe<T1, T2, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, R>): R
//     pipe<T1, R>(op1: Operator<EventStream<T>, T1>, op2: Operator<T1, R>): R
//     pipe<R>(op1: Operator<EventStream<T>, R>): R
//     pipe(): EventStream<T>;
//     pipe(...args: any[]): any;

//     listen(action: (payload: T) => void): TeardownLogic;
//     takeOne(action: (payload: T) => void): void;
// }

// export interface Behavior<T = any> {
//     value: T;

//     pipe<T1, T2, T3, T4, T5, T6, T7, T8, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, T6>, op7: Operator<T6, T7>, op8: Operator<T7, T8>, op9: Operator<T8, R>): R
//     pipe<T1, T2, T3, T4, T5, T6, T7, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, T6>, op7: Operator<T6, T7>, op8: Operator<T7, R>): R
//     pipe<T1, T2, T3, T4, T5, T6, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, T6>, op7: Operator<T6, R>): R
//     pipe<T1, T2, T3, T4, T5, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, T5>, op6: Operator<T5, R>): R
//     pipe<T1, T2, T3, T4, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, T4>, op5: Operator<T4, R>): R
//     pipe<T1, T2, T3, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, T3>, op4: Operator<T3, R>): R
//     pipe<T1, T2, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, T2>, op3: Operator<T2, R>): R
//     pipe<T1, R>(op1: Operator<Behavior<T>, T1>, op2: Operator<T1, R>): R
//     pipe<R>(op1: Operator<Behavior<T>, R>): R
//     pipe(): Behavior<T>;
//     pipe(...args: Operator<any, any>[]): any;

//     watch(effect: (value: T) => void): void;

//     // named proposal?
// }


export type Action<T> = (payload: T) => void;

export interface Disposable {
    dispose(): void;
}

export type TeardownLogic = () => void;