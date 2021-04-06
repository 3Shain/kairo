import {
    Type,
    ɵComponentDef as ComponentDef,
    ɵɵdirectiveInject,
    ɵɵProvidersFeature,
    INJECTOR,
    NgZone,
    Injectable,
    ɵɵdefineComponent as defineComponent,
    InjectFlags,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    SimpleChanges
} from '@angular/core';
import { createScope, data, transaction, isBehavior } from 'kairo';
import { KairoScope } from './kairo.service';


export function KairoComponent(options?: {
    untrackInputs?: string[],
    exposeAt?: 'this' | string;
}) {
    return <T>(componentType: Type<T>) => {

        const componentDef = (componentType['ɵcmp']) as ComponentDef<unknown>;

        componentType['ɵcmp'] = defineComponent({
            ...componentDef,
            features: [ɵɵProvidersFeature([
                // KairoInstance
            ]), (def) => {
                const originNgOnInit = def.type.prototype.ngOnInit as Function;
                const originNgOnChanges = def.type.prototype.ngOnChanges as Function;
                // ensure these method exist in prototype cuz ivy will store them.
                let hookedOnChange: Function = null;
                def.type.prototype.ngOnChanges = function (...args: any[]) {
                    hookedOnChange?.(...args);
                    originNgOnChanges?.call(this, ...args);
                }
                const originNgOnDestroy = def.type.prototype.ngOnDestroy as Function;
                let hookedOnDestroy: Function = null;
                def.type.prototype.ngOnDestroy = function () {
                    hookedOnDestroy?.();
                    originNgOnDestroy?.call(this);
                }
                def.type.prototype.ngOnInit = function () {
                    /**
                     * type: this:Component
                     */

                    const zone = ɵɵdirectiveInject(INJECTOR).get(NgZone);
                    const parentScope = ɵɵdirectiveInject(KairoScope, InjectFlags.SkipSelf | InjectFlags.Optional);
                    zone.runOutsideAngular(() => {
                        // console.log(Object.entries(componentDef.inputs));
                        const ref = ɵɵdirectiveInject(ChangeDetectorRef);

                        let inputsSetter: any = {};
                        const scope = createScope(() => {
                            let setupInputs: any = {};
                            for (const inputDeclaredName in def.declaredInputs) {
                                const [beh, setter] = data(this[def.declaredInputs[inputDeclaredName]]);
                                inputsSetter[inputDeclaredName] = setter;
                                setupInputs[inputDeclaredName] = beh;
                            }
                            const resolve = this.ngSetup(setupInputs);
                            if (typeof resolve != 'object') {
                                throw `ngSetup() is expected to return an object, but it got ${typeof resolve}`;
                            }
                            for (const [key, value] of Object.entries(resolve)) {
                                if (isBehavior(value)) {
                                    value.watch((v) => {
                                        this[key] = v;
                                    });
                                    resolve[key] = value.value;
                                } else if(typeof value === 'function'){
                                    resolve[key] = (...args:any[])=>{
                                        return transaction(()=>{
                                            return value(...args);
                                        });
                                    }
                                }
                            }
                            return resolve;
                        },null);
                        Object.assign(this, scope.exposed); //TODO: initial wtf

                        hookedOnChange = (changes: SimpleChanges) => {
                            zone.runOutsideAngular(() => {
                                // use scheduler? asapInTransaction.
                                transaction(() => {
                                    for (const key in changes) {
                                        inputsSetter[key](changes[key].currentValue);
                                    }
                                });
                            });
                        }

                        hookedOnDestroy = () => {
                            zone.runOutsideAngular(() => {
                                // scope.dispose();
                            });
                        }
                    });
                    originNgOnInit?.call(this);
                }
            }],
            changeDetection: ChangeDetectionStrategy.OnPush
        });
    };
}