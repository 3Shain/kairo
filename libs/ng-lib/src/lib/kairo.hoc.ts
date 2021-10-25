import {
  Type,
  ɵComponentDef as ComponentDef,
  ɵɵdirectiveInject,
  NgZone,
  InjectFlags,
  ChangeDetectorRef,
  Injector,
  SimpleChanges,
  ɵDirectiveDef as DirectiveDef,
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
} from 'kairo';
import { KairoScopeRefImpl } from './kairo.service';
import { NG_INJECTOR } from './tokens';

interface KairoDirectiveInstance {
  ɵɵkairoScope?: KairoScopeRefImpl;
  ɵɵinjector: Injector;
  ɵɵzone: NgZone;
  ɵɵlifecycleScope: LifecycleScope;
  ɵɵinit: boolean;
  ngSetup: Function;
  // ɵɵeffectQueue: LayoutQueue;
  ɵɵreferenceMap: { name: string; reference: SetReference }[];
}

export function WithKairo() {
  return <T>(componentType: Type<T>) => {
    /* istanbul ignore if  */
    if (!ivyEnabled) {
      throw TypeError(
        '@WithKairo() only works with ivy enabled. Non-ivy enviroment is not supported.'
      );
    }

    const directiveDefinition =
      (componentType['ɵcmp'] as ComponentDef<unknown>) ??
      (componentType['ɵdir'] as DirectiveDef<unknown>);
    const factoryOld = componentType['ɵfac'];
    /** Override component factory */
    Object.defineProperty(componentType, 'ɵfac', {
      get:
        () =>
        (...args: any) => {
          const instance = factoryOld(...args) as KairoDirectiveInstance;
          instance.ɵɵkairoScope = ɵɵdirectiveInject(
            KairoScopeRefImpl,
            InjectFlags.Optional
          );
          instance.ɵɵinjector = ɵɵdirectiveInject(Injector, InjectFlags.Self);
          instance.ɵɵzone = ɵɵdirectiveInject(NgZone);
          instance.ɵɵinit = false;
          instance.ɵɵreferenceMap = [];
          return instance;
        },
    });
    /**
     * Setup kairo
     */
    ((def: ComponentDef<unknown> | DirectiveDef<unknown>) => {
      if ('onPush' in def) {
        (def.onPush as any) = true; // component default onPush
      }
    })(directiveDefinition);

    const hasInputs = Object.keys(directiveDefinition.inputs).length > 0;

    // ensure these method exist in prototype cuz ivy will store them.
    const ngOnChangesOld = (
      hasInputs
        ? componentType.prototype.ngOnChanges
        : componentType.prototype.ngOnInit
    ) as Function;
    const ngOnDestroyOld = componentType.prototype.ngOnDestroy as Function;
    componentType.prototype.ngOnDestroy = function (
      this: KairoDirectiveInstance
    ) {
      this.ɵɵzone.runOutsideAngular(() => {
        this.ɵɵlifecycleScope.detach();
      });
      ngOnDestroyOld?.call(this);
    };

    const onChangesOrOnInit = function (
      this: KairoDirectiveInstance,
      changes: SimpleChanges
    ) {
      if (!this.ɵɵinit) {
        /* istanbul ignore if  */
        if (typeof this.ngSetup !== 'function') {
          console.error(`ngSetup is not declared.`);
          return;
        }
        const changeDetector = this.ɵɵinjector.get(ChangeDetectorRef);

        const localProviders = {
          [NG_INJECTOR]: this.ɵɵinjector,
          // [LAYOUT_QUEUE]: this.ɵɵeffectQueue
        };

        const context =
          this.ɵɵkairoScope?.context.inherit(localProviders) ??
          new Context().build(() => localProviders);

        this.ɵɵzone.runOutsideAngular(() => {
          const exitScope = collectScope();
          const exitContext = context.runInContext();

          try {
            const resolve = this.ngSetup(this);
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
                this.ɵɵreferenceMap.push({
                  name: key,
                  reference: value,
                });
              } else {
                this[key] = value;
              }
            }
            const syncChanges = () => {
              for (let [key, cell] of cells) {
                this[key] = cell.$;
              }
            };
            const r = new Reaction(() => {
              syncChanges();
              changeDetector.markForCheck();
            });
            syncChanges();
            lifecycle(() => {
              r.track(syncChanges);
              return () => r.dispose();
            });
          } finally {
            exitContext();
            this.ɵɵlifecycleScope = exitScope();
          }
        });
        this.ɵɵinit = true;
      }
      ngOnChangesOld?.call(this, changes);
    };

    if (hasInputs) componentType.prototype.ngOnChanges = onChangesOrOnInit;
    else componentType.prototype.ngOnInit = onChangesOrOnInit;

    const ngAfterViewInitOld = componentType.prototype
      .ngAfterViewInit as Function;
    const afterViewInit = function (this: KairoDirectiveInstance) {
      for (const entry of this.ɵɵreferenceMap) {
        const target = this[entry.name];
        if (target instanceof ElementRef) {
          entry.reference(target.nativeElement);
        } else {
          entry.reference(target);
        }
      }
      this.ɵɵlifecycleScope.attach();
      ngAfterViewInitOld?.call(this);
    };
    componentType.prototype.ngAfterViewInit = afterViewInit;

    const ngAfterViewCheckedOld = componentType.prototype
      .ngAfterViewChecked as Function;
    const afterViewChecked = function (this: KairoDirectiveInstance) {
      for (const entry of this.ɵɵreferenceMap) {
        const target = this[entry.name];
        if (target instanceof ElementRef) {
          entry.reference(target.nativeElement);
        } else {
          entry.reference(target);
        }
      }
      ngAfterViewCheckedOld?.call(this);
    };
    componentType.prototype.ngAfterViewChecked = afterViewChecked;
  };
}
