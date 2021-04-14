import { Injectable } from '@angular/core';
import {
    disposeScope,
    Scope,
    inject,
    createScope,
    Behavior,
    InjectToken,
    ExtractBehaviorProperty,
    isBehavior,
    action,
    Factory,
} from 'kairo';
import { Observable, ReplaySubject } from 'rxjs';
import { publishReplay, refCount, switchMap } from 'rxjs/operators';

export abstract class KairoScopeRef {
    public readonly scope: Scope;

    abstract useInject<T>(
        fn: Factory<T>,
        options?: {
            optional?: boolean;
            skipSelf?: boolean;
        }
    ): T extends Behavior<infer C>
        ? Observable<C>
        : Observable<ExtractBehaviorProperty<T>>;
    abstract useInject<T>(
        token: InjectToken<T>,
        options?: {
            optional?: true;
            skipSelf?: boolean;
            defaultValue: T;
        }
    ): T extends Behavior<infer C>
        ? Observable<C>
        : Observable<ExtractBehaviorProperty<T>>;
    abstract useInject<T>(
        token: InjectToken<T>,
        options?: {
            optional?: boolean;
            skipSelf?: boolean;
        }
    ): T extends Behavior<infer C>
        ? Observable<C>
        : Observable<ExtractBehaviorProperty<T>>;
}

@Injectable()
export class KairoScopeRefImpl {
    public scope: Scope;

    constructor() {}

    useInject<T>(
        fn: Factory<T>,
        options?: {
            optional?: boolean;
            skipSelf?: boolean;
        }
    ): T extends Behavior<infer C>
        ? Observable<C>
        : Observable<ExtractBehaviorProperty<T>>;
    useInject<T>(
        token: InjectToken<T>,
        options?: {
            optional?: true;
            skipSelf?: boolean;
            defaultValue: T;
        }
    ): T extends Behavior<infer C>
        ? Observable<C>
        : Observable<ExtractBehaviorProperty<T>>;
    useInject<T>(
        token: InjectToken<T>,
        options?: {
            optional?: boolean;
            skipSelf?: boolean;
        }
    ): T extends Behavior<infer C>
        ? Observable<C>
        : Observable<ExtractBehaviorProperty<T>> {
        return this.init$.pipe(
            switchMap(() => {
                return new Observable<any>((observer) => {
                    const { scope } = createScope(() => {
                        const resolve = inject(token, options);
                        if (typeof resolve !== 'object' || resolve === null) {
                            observer.next(resolve);
                            return;
                        }
                        if (isBehavior(resolve)) {
                            observer.next(resolve.value);
                            resolve.watch((x) => observer.next(x));
                            return;
                        }
                        let expose = {};
                        for (const [key, value] of Object.entries(resolve)) {
                            if (typeof value === 'function') {
                                expose[key] = action(value);
                            } else if (isBehavior(value)) {
                                expose[key] = value.value;
                                value.watch((updatedValue) => {
                                    expose = {
                                        ...expose,
                                        [key]: updatedValue,
                                    };
                                    observer.next(expose);
                                });
                            } else {
                                expose[key] = value;
                            }
                        }
                        observer.next(expose);
                    }, this.scope); // it should be avaliable
                    return () => {
                        disposeScope(scope);
                    };
                });
            }),
            publishReplay(1),
            refCount()
        ) as any; // type is a mess
    }

    private init$ = new ReplaySubject<void>(1);

    /**
     * @private
     */
    __initialize() {
        this.init$.next(void 0);
        this.init$.complete();
    }
}
