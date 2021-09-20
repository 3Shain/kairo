import {
  Inject,
  Injectable,
  InjectionToken,
  Provider,
  Self,
  SkipSelf,
  Optional,
  OnDestroy,
} from '@angular/core';
import {
  collectScope,
  Concern,
  Concerns,
  Context,
  LifecycleScope,
  reduceConcerns,
} from 'kairo';

export abstract class ScopeRef {
  public readonly context: Context;
}

const CONCERN = new InjectionToken<Concern>('kairo concern');

@Injectable()
export class KairoScopeRefImpl implements OnDestroy {
  public context: Context;
  private lifecycle: LifecycleScope;

  constructor(
    @Inject(CONCERN)
    @Self()
    concern: Concern,
    @SkipSelf() @Optional() parentScopeRef?: KairoScopeRefImpl
  ) {
    const exitScope = collectScope();
    this.context = (parentScopeRef?.context ?? new Context()).build(concern);
    this.lifecycle = exitScope();
    this.lifecycle.attach();
  }

  ngOnDestroy() {
    this.lifecycle.detach();
  }
}

export function provideConcern(concern: Concern) {
  return [
    {
      provide: CONCERN,
      useValue: concern,
    },
    KairoScopeRefImpl,
    {
      provide: ScopeRef,
      useExisting: KairoScopeRefImpl,
    },
  ] as Provider[];
}

export function provideConcerns(concerns: Concerns) {
  return provideConcern(reduceConcerns(concerns));
}
