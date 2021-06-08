import {
    ModuleWithProviders,
    NgModule,
    Optional,
    SkipSelf,
    InjectionToken,
} from '@angular/core';
import { ScopeRef, KairoScopeRefImpl } from './kairo.service';
import { Scope } from 'kairo';

const SETUP_FUNCTION = new InjectionToken<() => void>('kairo setup function');

export function setupRootScope(setup: () => void) {
    const scope = new Scope();
    const endScope = scope.beginScope();
    setup();
    endScope();
    const ngService = new KairoScopeRefImpl();
    ngService.scope = scope;
    return ngService;
}

export function setupModuleScope(parent: KairoScopeRefImpl, setup: () => void) {
    const scope = new Scope(null, parent.scope);
    const endScope = scope.beginScope();
    setup();
    endScope();
    const ngService = new KairoScopeRefImpl();
    ngService.scope = scope;
    return ngService;
}

@NgModule({})
export class KairoModule {
    private detachHandler: () => void;
    constructor(private scopeRef: KairoScopeRefImpl) {
        this.detachHandler = this.scopeRef.scope.attach();
        this.scopeRef.__initialize();
    }

    ngOnDestroy() {
        this.detachHandler!();
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
                    provide: ScopeRef,
                    useExisting: KairoScopeRefImpl,
                },
            ],
        };
    }

    static forChild(setup: () => void): ModuleWithProviders<KairoModule> {
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
                    provide: ScopeRef,
                    useExisting: KairoScopeRefImpl,
                },
            ],
        };
    }
}
