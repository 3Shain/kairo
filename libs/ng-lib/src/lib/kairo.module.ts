import {
  ModuleWithProviders,
  NgModule,
  InjectionToken,
  NgModuleRef,
  Inject,
} from '@angular/core';
import { ScopeRef, KairoScopeRefImpl } from './kairo.service';
import { mount, Scope } from 'kairo';

const SETUP_FUNCTION = new InjectionToken<() => void>('kairo setup function');
const ROOT_SCOPE = new InjectionToken<Scope>('kairo root scope');

export function setupRootScope(setup: () => void) {
  const rootScope = new Scope();
  const endScope = rootScope.beginScope();
  // platform inject
  setup();
  endScope();
  return rootScope;
}

const noop = () => {};

@NgModule({})
export class KairoModule {
  constructor(
    @Inject(ROOT_SCOPE) rootScope: Scope,
    ngModuleRef: NgModuleRef<KairoModule>,
    scopeRef: KairoScopeRefImpl
  ) {
    // https://github.com/angular/angular/issues/18831
    ngModuleRef.onDestroy(rootScope.attach());
    scopeRef.scope = new Scope(undefined, rootScope);
  }

  static forRoot(setup?: () => void): ModuleWithProviders<KairoModule> {
    return {
      ngModule: KairoModule,
      providers: [
        {
          provide: SETUP_FUNCTION,
          useValue: setup ?? noop,
        },
        {
          provide: ROOT_SCOPE,
          useFactory: setupRootScope,
          deps: [SETUP_FUNCTION],
        },
        KairoScopeRefImpl,
        {
          provide: ScopeRef,
          useExisting: KairoScopeRefImpl,
        },
      ],
    };
  }
}
