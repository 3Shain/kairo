import {
    Type,
    ɵComponentDef as ComponentDef,
    ɵɵdirectiveInject,
    ɵɵProvidersFeature,
    NgZone,
    InjectFlags,
    ChangeDetectorRef,
    Injector,
} from '@angular/core';
import {
    createScope,
    mutable,
    transaction,
    isBehavior,
    disposeScope,
    action,
} from 'kairo';
import { KairoScopeRef, KairoScopeRefImpl } from './kairo.service';

export function WithKairo() {
    return <T>(componentType: Type<T>) => {
        const componentDef = componentType['ɵcmp'] as ComponentDef<unknown>;
        const originFac = componentType['ɵfac'];
        componentType['ɵfac'] = (...args: any) => {
            const origin = originFac(...args);
            origin['__kairo_parent_scope__'] = ɵɵdirectiveInject(
                KairoScopeRefImpl,
                InjectFlags.SkipSelf
            );
            origin['__kairo_scope__'] = ɵɵdirectiveInject(
                KairoScopeRefImpl,
                InjectFlags.Self
            );
            origin['__injector__'] = ɵɵdirectiveInject(
                Injector,
                InjectFlags.Self
            );
            return origin;
        };
        const features = [
            ɵɵProvidersFeature([
                {
                    provide: KairoScopeRefImpl,
                    useClass: KairoScopeRefImpl,
                },
                {
                    provide: KairoScopeRef,
                    useExisting: KairoScopeRefImpl,
                },
            ]),
            (def: ComponentDef<unknown>) => {
                (def.onPush as any) = true;
                const originNgOnInit = def.type.prototype.ngOnInit as Function;
                const originNgOnChanges = def.type.prototype
                    .ngOnChanges as Function;
                // ensure these method exist in prototype cuz ivy will store them.
                let hookedOnChange: Function = null;
                def.type.prototype.ngOnChanges = function (...args: any[]) {
                    hookedOnChange?.call(this, ...args);
                    originNgOnChanges?.call(this, ...args);
                };
                const originNgOnDestroy = def.type.prototype
                    .ngOnDestroy as Function;
                let hookedOnDestroy: Function = null;
                def.type.prototype.ngOnDestroy = function () {
                    hookedOnDestroy?.();
                    originNgOnDestroy?.call(this);
                };

                def.type.prototype.ngOnInit = function (this: {
                    __kairo_parent_scope__: KairoScopeRefImpl;
                    __kairo_scope__: KairoScopeRefImpl;
                    __injector__: Injector;
                    ngSetup: Function;
                }) {
                    if (typeof this.ngSetup !== 'function') {
                        console.error(`ngSetup is not declared.`);
                        return;
                    }
                    const changesHook: Function[] = [];
                    const zone = this.__injector__.get(NgZone);
                    const changeDetector = this.__injector__.get(
                        ChangeDetectorRef
                    );
                    zone.runOutsideAngular(() => {
                        const { scope, exposed } = createScope(() => {
                            const resolve = this.ngSetup((thunk: Function) => {
                                const [beh, setbeh] = mutable(thunk(this));
                                changesHook.push((instance: unknown) => {
                                    setbeh(thunk(instance));
                                });
                                return beh;
                            });
                            if (typeof resolve != 'object') {
                                throw Error(
                                    `ngSetup() is expected to return an object, but it got ${typeof resolve}`
                                );
                            }
                            for (const [key, value] of Object.entries(
                                resolve
                            )) {
                                if (isBehavior(value)) {
                                    value.watch((v) => {
                                        this[key] = v;
                                        changeDetector.detectChanges();
                                    });
                                    resolve[key] = value.value;
                                } else if (typeof value === 'function') {
                                    resolve[key] = action(value as any);
                                }
                            }
                            return resolve;
                        }, this.__kairo_parent_scope__.scope);
                        this.__kairo_scope__.scope = scope;
                        Object.assign(this, exposed);

                        hookedOnChange = () => {
                            zone.runOutsideAngular(() => {
                                transaction(() => {
                                    changesHook.forEach((x) => x(this));
                                });
                            });
                        };

                        hookedOnDestroy = () => {
                            zone.runOutsideAngular(() => {
                                disposeScope(scope);
                            });
                        };
                    });
                    originNgOnInit?.call(this);
                    this.__kairo_scope__.__initialize();
                };
            },
        ];
        features.forEach((x) => x(componentDef));
    };
}
