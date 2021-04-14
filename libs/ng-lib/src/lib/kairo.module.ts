import {
    ModuleWithProviders,
    NgModule,
    Optional,
    SkipSelf,
    InjectionToken,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KairoScopeRef, KairoScopeRefImpl } from './kairo.service';
import { createScope, disposeScope } from 'kairo';

const SETUP_FUNCTION = new InjectionToken<() => void>('kairo setup function');

export function setupRootScope(setup: () => void) {
    const { scope } = createScope(setup);
    const ngService = new KairoScopeRefImpl();
    ngService.scope = scope;
    return ngService;
}

export function setupModuleScope(parent: KairoScopeRefImpl, setup: () => void) {
    const { scope } = createScope(setup, null, parent.scope);
    const ngService = new KairoScopeRefImpl();
    ngService.scope = scope;
    return ngService;
}

@NgModule({
    imports: [CommonModule],
})
export class KairoModule {
    constructor(private scopeRef: KairoScopeRefImpl) {
        this.scopeRef.__initialize();
    }

    ngOnDestroy() {
        disposeScope(this.scopeRef.scope);
    }

    static forRoot(setup: () => void): ModuleWithProviders<KairoModule> {
        return {
            ngModule: KairoModule,
            providers: [
                {
                    provide: SETUP_FUNCTION,
                    useValue: setup,
                },
                {
                    provide: KairoScopeRefImpl,
                    useFactory: setupRootScope,
                    deps: [SETUP_FUNCTION],
                },
                {
                    provide: KairoScopeRef,
                    useExisting: KairoScopeRefImpl,
                },
            ],
        };
    }

    static forFeature(setup: () => void): ModuleWithProviders<KairoModule> {
        return {
            ngModule: KairoModule,
            providers: [
                {
                    provide: SETUP_FUNCTION,
                    useValue: setup,
                },
                {
                    provide: KairoScopeRefImpl,
                    useFactory: setupModuleScope,
                    deps: [
                        [Optional, SkipSelf, KairoScopeRefImpl],
                        SETUP_FUNCTION,
                    ],
                },
                {
                    provide: KairoScopeRef,
                    useExisting: KairoScopeRefImpl,
                },
            ],
        };
    }
}
