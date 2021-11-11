import {
  Type,
  ɵɵdirectiveInject,
  NgZone,
  InjectFlags,
  ChangeDetectorRef,
  Injector,
  ɵivyEnabled as ivyEnabled,
  ElementRef,
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
  Identifier,
  CONCERN_HOC_FACTORY,
  Concern,
} from 'kairo';
import {
  withConcern,
  bindConcern,
  KAIRO_CONTEXT,
  LIFECYCLE_SCOPE,
} from './application';
import {
  hookFactory,
  overrideLifecyleAppend,
  overrideLifecylePrepend,
  prependProviders,
} from './hoc';

export const NG_INJECTOR = Identifier.of<Injector>('NG INJECTOR');

interface KairoDirectiveInstance {
  ɵɵinjector: Injector;
  ɵɵzone: NgZone;
  ɵɵlifecycleScope: LifecycleScope;
  ngSetup: Function;
  ɵɵreferenceMap: { name: string; reference: SetReference }[];
}

export function WithKairo(concern?: Concern) {
  return <T>(componentType: Type<T>) => {
    /* istanbul ignore if: defensive  */
    if (!ivyEnabled) {
      throw new TypeError(
        '@WithKairo() only works with ivy enabled. Non-ivy enviroment is not supported.'
      );
    }
    /* istanbul ignore if: defensive  */
    if (componentType['__KAIRO_COMPONENT']) {
      throw new Error(
        'Decorated component is already a kairo component. Composing decoration is not supported yet.'
      );
    }

    if (concern) {
      prependProviders(
        componentType['ɵcmp'] ?? componentType['ɵdir'],
        bindConcern(concern)
      );
    }

    /** Override component factory */
    hookFactory<KairoDirectiveInstance>(componentType as any, (instance) => {
      const parentContext = ɵɵdirectiveInject(
        KAIRO_CONTEXT,
        InjectFlags.Optional
      );
      const parentConcernLifescope = ɵɵdirectiveInject(
        LIFECYCLE_SCOPE,
        InjectFlags.Optional | InjectFlags.Self
      );
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
        [CONCERN_HOC_FACTORY]: withConcern,
      };

      const context = (parentContext ?? Context.EMPTY)
        .inherit(localProviders);

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
          lifecycle(() => parentConcernLifescope?.attach());
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

    componentType['__KAIRO_COMPONENT'] = true;
  };
}
