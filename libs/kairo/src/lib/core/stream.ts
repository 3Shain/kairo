/**
 *
 * So damn simple.
 *
 * Warning:
 * Never write logics that _depends on_ the order of subscription, it is never guaranteed!
 */

interface Subscription<T> {
    slot: number;
    next: (payload: T) => void;
    closed: boolean;
}

interface Emitter<T = any> {
    subscribers: Subscription<T>[];
    nextSubscribers: Subscription<T>[];
}

function createStream<T = any>() {
    return {
        subscribers: [],
        subscriptionSlots: [],
        nextSubscribers: [],
        nextSubscriptionSlots: [],
    } as Emitter<T>;
}

function subscribe<T>(event: Emitter<T>, fn: (payload: T) => void) {
    const subscription = {
        slot: event.subscribers.length,
        next: fn,
    } as Subscription<T>;
    event.subscribers.push(subscription);
    return subscription;
}

function unsubscribe<T>(event: Emitter<T>, subscripton: Subscription<T>) {
    if (subscripton.closed) {
        return;
    }
    subscripton.closed = true;
    const lastSubscription = event.subscribers.pop()!;
    if (subscripton.slot !== lastSubscription.slot) {
        event.subscribers[subscripton.slot] = lastSubscription;
        lastSubscription.slot = subscripton.slot;
    }
}

function subscribeNext<T>(event: Emitter<T>, fn: (payload: T) => void) {
    const subscription = {
        slot: event.nextSubscribers.length,
        next: fn,
        closed: false
    } as Subscription<T>;
    event.nextSubscribers.push(subscription);
    return subscription;
}

function unsusbcribeNext<T>(event: Emitter<T>, subscripton: Subscription<T>) {
    if (subscripton.closed) {
        return;
    }
    subscripton.closed = true;
    const lastSubscription = event.nextSubscribers.pop()!;
    if (subscripton.slot !== lastSubscription.slot) {
        event.nextSubscribers[subscripton.slot] = lastSubscription;
        lastSubscription.slot = subscripton.slot;
    }
}

function emitEvent<T>(this: Emitter<T>, payload: T): void {
    for (const sub of this.subscribers) {
        sub.next(payload);
    }
    const nextSubs = this.nextSubscribers;
    this.nextSubscribers = [];
    while (nextSubs.length) {
        const sub = nextSubs.pop()!;
        sub.closed = true;
        sub.next(payload);
    }
    return;
}

export {
    Emitter,
    Subscription,
    createStream,
    subscribe,
    unsubscribe,
    subscribeNext,
    unsusbcribeNext,
    emitEvent
};