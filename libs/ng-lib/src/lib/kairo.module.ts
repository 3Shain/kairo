import {
  ModuleWithProviders,
  NgModule,
  InjectionToken,
} from '@angular/core';
import { ScopeRef, KairoScopeRefImpl } from './kairo.service';
import { Scope } from 'kairo';

const SETUP_FUNCTION = new InjectionToken<() => void>('kairo setup function');

export function setupRootScope(setup: () => void) {
  const rootScope = new Scope();
  const endScope = rootScope.beginScope();
  // platform inject
  setup();
  endScope();
  const ngService = new KairoScopeRefImpl();
  ngService.scope = new Scope(undefined, rootScope);
  return ngService;
}

const noop = () => {};

@NgModule({})
export class KairoModule {
  private detachHandler: () => void;
  constructor(private scopeRef: KairoScopeRefImpl) {
    this.detachHandler = this.scopeRef.scope.attach();
  }

  ngOnDestroy() {
    this.detachHandler!();
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
}
