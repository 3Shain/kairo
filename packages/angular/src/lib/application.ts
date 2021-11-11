import {
  Type,
  InjectFlags,
  ɵɵProvidersFeature as useProvidersFeature,
  ɵɵdefineComponent as defineComponent,
  ViewEncapsulation,
  ViewContainerRef,
  ComponentFactoryResolver,
  ɵɵdirectiveInject as directiveInject,
  InjectionToken,
  Self,
  SkipSelf,
  Optional,
  ɵDirectiveType,
  ɵComponentType,
} from '@angular/core';
import { Concern, LifecycleScope, Context, collectScope, CONCERN_HOC_FACTORY } from 'kairo';

export const KAIRO_CONTEXT = new InjectionToken<Context>('KairoContext');
export const LIFECYCLE_SCOPE = new InjectionToken<LifecycleScope>(
  '[KairoInternal]LifecycleScope'
);
const CONCERN_INSTANCE = new InjectionToken<[Context, LifecycleScope]>(
  '[KairoInternal]ConcernInstance'
);

export function withConcern<T extends Type<T>>(concern: Concern) {
  return (component: T) => {
    return createComponent(concern, component) as T;
  };
}

// 3Shain: I bet this will fail in SSR

// Level 1: DI works <- we are here
// Level 2: Input/Output works
// Level 3: Content Projection works
// Level 1 is enough though
function createComponent(concern: Concern, Component: Type<any>) {
  class DoubleComponent {
    instance: any;
    constructor(
      vcr: ViewContainerRef,
      cfr: ComponentFactoryResolver,
      private scope: LifecycleScope
    ) {
      const fac = cfr.resolveComponentFactory(Component);
      this.instance = vcr.createComponent(
        fac,
        undefined,
        // https://github.com/angular/angular/issues/31776
        // NodeInjector.get doesn't respect flags
        vcr.injector
      ).instance;
    }

    ngAfterViewInit() {
      this.scope.attach();
    }

    ngOnDestroy() {
      this.scope.detach();
    }
  }

  (DoubleComponent as ɵComponentType<DoubleComponent>).ɵcmp = defineComponent({
    type: DoubleComponent,
    selectors: [[`kairo-component-outlet`]],
    features: [useProvidersFeature(bindConcern(concern))],
    decls: 1,
    vars: 0,
    template: function Template(rf) {},
    styles: [],
    encapsulation: ViewEncapsulation.None,
  });
  (DoubleComponent as ɵDirectiveType<DoubleComponent>).ɵfac = function factory(
    t: Type<any>
  ) {
    return new (t || DoubleComponent)(
      directiveInject(ViewContainerRef),
      directiveInject(ComponentFactoryResolver),
      directiveInject(LIFECYCLE_SCOPE, InjectFlags.Self)
    );
  };
  return DoubleComponent as typeof Component; // it's fake!
}

export function bindConcern(concern: Concern) {
  return [
    {
      provide: CONCERN_INSTANCE,
      useFactory: (ctx: Context) => {
        const endCollect = collectScope();
        return [(ctx ?? Context.EMPTY).inherit({
          [CONCERN_HOC_FACTORY]: withConcern
        }).build(concern), endCollect()];
      },
      deps: [[new SkipSelf(), new Optional(), KAIRO_CONTEXT]],
    },
    {
      provide: KAIRO_CONTEXT,
      useFactory: (instance: [Context]) => instance[0],
      deps: [[new Self(), CONCERN_INSTANCE]],
    },
    {
      provide: LIFECYCLE_SCOPE,
      useFactory: (instance: [Context, LifecycleScope]) => instance[1],
      deps: [[new Self(), CONCERN_INSTANCE]],
    },
  ];
}
