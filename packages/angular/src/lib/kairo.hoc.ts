import {
  Type,
  ɵComponentDef as ComponentDef,
  ɵComponentType as ComponentType,
  ɵɵdirectiveInject,
  NgZone,
  InjectFlags,
  ChangeDetectorRef,
  Injector,
  ɵivyEnabled as ivyEnabled,
  ElementRef,
  Injectable,
  ɵɵProvidersFeature as useProvidersFeature,
  ɵɵdefineComponent as defineComponent,
  ɵɵelement as element,
  ɵɵproperty as property,
  ViewEncapsulation,
  ɵAttributeMarker,
  ViewContainerRef,
  ComponentFactoryResolver,
  ɵɵdirectiveInject as directiveInject,
  InjectionToken,
  Inject,
} from '@angular/core';
import {
  isCell,
  SetReference,
  Context,
  lifecycle,
  LifecycleScope,
  collectScope,
  Cell,
  Reaction,
  isReferenceSetter,
  Track,
} from 'kairo';
import {
  appendProviders,
  hookFactory,
  overrideLifecyleAppend,
  overrideLifecylePrepend,
} from './hoc';
import { KairoScopeRefImpl } from './kairo.service';
import { NG_INJECTOR } from './tokens';

interface KairoDirectiveInstance {
  ɵɵkairoScope?: KairoScopeRefImpl;
  ɵɵinjector: Injector;
  ɵɵzone: NgZone;
  ɵɵlifecycleScope: LifecycleScope;
  ngSetup: Function;
  // ɵɵeffectQueue: LayoutQueue;
  ɵɵreferenceMap: { name: string; reference: SetReference }[];
}

// let createNumber = 0;
// let rcd = 0;

// export function createComponent(component: Type<any>) {
//   const directiveDefinition = component['ɵcmp'] as ComponentDef<unknown>;
//   // assert: no extra selectors:
//   const targetComponentSelector = directiveDefinition.selectors[0][0] as string;

//   const FakeComponent: ComponentType<any> = class {
//     constructor() {
//       console.log('a fake component created');
//     }
//   } as any;
//   const bindings = [
//     ...Object.keys(directiveDefinition.inputs),
//     ...Object.keys(directiveDefinition.outputs),
//   ];
//   FakeComponent.ɵcmp = defineComponent({
//     type: FakeComponent,
//     selectors: [[`fake-component-${createNumber++}`]],
//     features: [],
//     decls: 1,
//     inputs: directiveDefinition.inputs,
//     outputs: directiveDefinition.outputs,
//     vars: bindings.length,
//     consts: [[ɵAttributeMarker.Bindings, ...bindings]],
//     template: function Template(rf, ctx) {
//       if (rf & 1) {
//         element(0, targetComponentSelector, 0);
//       }
//       if (rf & 2) {
//         bindings.forEach((x) => {
//           property(x, ctx[x]);
//         });
//       }
//     },
//     directives: [component],
//     styles: [],
//     encapsulation: ViewEncapsulation.None,
//   });
//   (FakeComponent as any).ɵfac = function factory(t: Type<any>) {
//     return new (t || FakeComponent)();
//   };
//   return FakeComponent as typeof component;
// }

// export function createComponent22(Component: Type<any>) {
//   class DoubleComponent extends Component {
//     static ɵcmp = {
//       ...Component['ɵcmp'],
//       type: DoubleComponent,
//       id: 'kairo_' + rcd++,
//     };
//     static ɵfac = () => Component['ɵfac'](DoubleComponent);

//     constructor(...args: any[]) {
//       super(...args);
//     }

//     // to avoid ngc error
//     ['ngAfterViewInit']() {
//       // init
//       super.ngAfterViewInit();
//     }

//     // to avoid ngc error
//     ['ngOnDestroy']() {
//       super.ngOnDestroy();
//       // des
//     }
//   }
//   Object.defineProperty(DoubleComponent, 'name', { value: Component.name });
//   appendProviders(DoubleComponent.ɵcmp, [

//   ]);
//   return DoubleComponent as typeof Component;
// }

// export function createComponent2(Component: Type<any>) {
//   // assert: no extra selectors:
//   const DoubleComponent: ComponentType<any> = class {
//     constructor(vcr: ViewContainerRef, cfr: ComponentFactoryResolver) {
//       const fac = cfr.resolveComponentFactory(Component);
//       vcr.createComponent(fac, undefined, vcr.injector).instance;
//     }

//     ngOnDestroy() {
//       console.log('imfine')
//     }
//   } as any;

//   DoubleComponent.ɵcmp = defineComponent({
//     type: DoubleComponent,
//     selectors: [[`kairo-component-outlet`]],
//     features: [
//       useProvidersFeature(
//         []
//       ),
//     ],
//     decls: 1,
//     vars: 0,
//     template: function Template(rf) {},
//     styles: [],
//     encapsulation: ViewEncapsulation.None,
//   });
//   (DoubleComponent as any).ɵfac = function factory(t: Type<any>) {
//     return new (t || DoubleComponent)(
//       directiveInject(ViewContainerRef),
//       directiveInject(ComponentFactoryResolver)
//     );
//   };
//   return DoubleComponent as typeof Component;
// }

export function WithKairo() {
  return <T>(componentType: Type<T>) => {
    /* istanbul ignore if  */
    if (!ivyEnabled) {
      throw TypeError(
        '@WithKairo() only works with ivy enabled. Non-ivy enviroment is not supported.'
      );
    }

    /** Override component factory */
    hookFactory<KairoDirectiveInstance>(componentType as any, (instance) => {
      const kairoScope = (instance.ɵɵkairoScope = ɵɵdirectiveInject(
        KairoScopeRefImpl,
        InjectFlags.Optional
      ));
      const injector = (instance.ɵɵinjector = ɵɵdirectiveInject(
        Injector,
        InjectFlags.Self
      ));
      const zone = (instance.ɵɵzone = ɵɵdirectiveInject(NgZone));
      const referenceMap = (instance.ɵɵreferenceMap = []);

      /* istanbul ignore if  */
      if (typeof instance.ngSetup !== 'function') {
        console.error(`ngSetup is not declared.`);
        return;
      }
      const changeDetector = injector.get(ChangeDetectorRef);

      const localProviders = {
        [NG_INJECTOR]: injector,
        // [LAYOUT_QUEUE]: this.ɵɵeffectQueue
      };

      const context =
        kairoScope?.context.inherit(localProviders) ??
        new Context().build(() => localProviders);

      zone.runOutsideAngular(() => {
        const exitScope = collectScope();
        const exitContext = context.runInContext();

        try {
          const resolve = instance.ngSetup(instance);
          if (resolve === undefined) {
            return {};
          }
          /* istanbul ignore if  */
          if (typeof resolve !== 'object') {
            throw Error(
              `ngSetup() is expected to return an object, but it got ${typeof resolve}`
            );
          }
          const cells = new Map<string, Cell<any>>();
          for (const [key, value] of Object.entries(resolve)) {
            if (isCell(value)) {
              cells.set(key, value);
            } else if (isReferenceSetter(value)) {
              referenceMap.push({
                name: key,
                reference: value,
              });
            } else {
              instance[key] = value;
            }
          }
          const syncChanges = () => {
            r.track(($) => {
              for (let [key, cell] of cells) {
                instance[key] = $(cell);
              }
            });
          };
          const r = new Reaction(() => {
            syncChanges();
            changeDetector.markForCheck();
          });
          syncChanges();
          lifecycle(() => {
            return () => r.dispose();
          });
        } finally {
          exitContext();
          instance.ɵɵlifecycleScope = exitScope();
        }
      });
      return instance;
    });

    overrideLifecylePrepend<KairoDirectiveInstance>(
      componentType as any as Type<KairoDirectiveInstance>,
      {
        ngAfterViewInit: function () {
          for (const entry of this.ɵɵreferenceMap) {
            const target = this[entry.name];
            if (target instanceof ElementRef) {
              entry.reference(target.nativeElement);
            } else {
              entry.reference(target);
            }
          }
          this.ɵɵzone.runOutsideAngular(() => {
            this.ɵɵlifecycleScope.attach();
          });
        },
        ngAfterViewChecked: function () {
          for (const entry of this.ɵɵreferenceMap) {
            const target = this[entry.name];
            if (target instanceof ElementRef) {
              entry.reference(target.nativeElement);
            } else {
              entry.reference(target);
            }
          }
        },
      }
    );

    overrideLifecyleAppend<KairoDirectiveInstance>(
      componentType as any as Type<KairoDirectiveInstance>,
      {
        ngOnDestroy: function () {
          this.ɵɵzone.runOutsideAngular(() => {
            this.ɵɵlifecycleScope.detach();
          });
        },
      }
    );
  };
}
