import {
    ModuleWithProviders,
    NgModule,
    Optional,
    SkipSelf,
    InjectionToken,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KairoScope } from './kairo.service';
import { createScope } from 'kairo';

const SETUP_FUNCTION = new InjectionToken<() => void>('kairo setup function');

export function setupRootScope(setup: () => void) {
    const { scope } = createScope(setup);
    const ngService = new KairoScope();
    ngService.scope = scope;
    return ngService;
}

export function setupModuleScope(parent: KairoScope, setup: () => void) {
    const { scope } = createScope(setup, null, parent.scope);
    const ngService = new KairoScope();
    ngService.scope = scope;
    return ngService;
}

@NgModule({
    imports: [CommonModule],
})
export class KairoModule {
    static forRoot(setup: () => void): ModuleWithProviders<KairoModule> {
        return {
            ngModule: KairoModule,
            providers: [
                {
                    provide: SETUP_FUNCTION,
                    useValue: setup,
                },
                {
                    provide: KairoScope,
                    useFactory: setupRootScope,
                    deps: [SETUP_FUNCTION],
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
                    provide: KairoScope,
                    useFactory: setupModuleScope,
                    deps: [[Optional, SkipSelf, KairoScope], SETUP_FUNCTION],
                },
            ],
        };
    }
}
