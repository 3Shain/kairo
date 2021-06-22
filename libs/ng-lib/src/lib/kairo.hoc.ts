import {
  Type,
  ɵComponentDef as ComponentDef,
  ɵɵdirectiveInject,
  ɵɵProvidersFeature,
  NgZone,
  InjectFlags,
  ChangeDetectorRef,
  Injector,
  SimpleChanges,
  Provider,
  ɵDirectiveDef as DirectiveDef,
  ɵivyEnabled as ivyEnabled,
} from '@angular/core';
import {
  mutValue,
  transaction,
  isCell,
  action,
  Scope,
  effect,
  provide,
  Reference,
} from 'kairo';
import { ScopeRef, KairoScopeRefImpl } from './kairo.service';
import { NG_INJECTOR } from './tokens';

interface KairoDirectiveInstance {
  ɵɵkairoParentScope: KairoScopeRefImpl;
  ɵɵkairoScope: KairoScopeRefImpl;
  ɵɵinjector: Injector;
  ɵɵzone: NgZone;
  ɵɵkairoDetachFn: () => void;
  ɵɵinit: boolean;
  ɵɵchangesHook: Function[];
  ngSetup: Function;
  ɵɵreferenceMap: { name: string; reference: Reference<any> }[];
}

export function WithKairo(obj?: {
  /**
   * Configures the [injector](guide/glossary#injector) of this
   * directive or component with a [token](guide/glossary#di-token)
   * that maps to a [provider](guide/glossary#provider) of a dependency.
   */
  providers?: Provider[];
  /**
   * Defines the set of injectable objects that are visible to its view DOM children.
   * See [example](#injecting-a-class-with-a-view-provider).
   *
   */
  viewProviders?: Provider[];
}) {
  return <T>(componentType: Type<T>) => {
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
      get: () => (...args: any) => {
        const instance = factoryOld(...args) as KairoDirectiveInstance;
        instance.ɵɵkairoParentScope = ɵɵdirectiveInject(
          KairoScopeRefImpl,
          InjectFlags.SkipSelf | InjectFlags.Optional
        );
        instance.ɵɵkairoScope = ɵɵdirectiveInject(
          KairoScopeRefImpl,
          InjectFlags.Self
        );
        instance.ɵɵinjector = ɵɵdirectiveInject(Injector, InjectFlags.Self);
        instance.ɵɵzone = ɵɵdirectiveInject(NgZone);
        instance.ɵɵinit = false;
        instance.ɵɵchangesHook = [];
        instance.ɵɵreferenceMap = [];
        return instance;
      },
    });
    /**
     * Setup Angular DI
     */
    ɵɵProvidersFeature(
      [
        {
          provide: KairoScopeRefImpl,
          useClass: KairoScopeRefImpl,
        },
        {
          provide: ScopeRef,
          useExisting: KairoScopeRefImpl,
        },
        ...(obj?.providers ?? []),
      ],
      [...(obj?.viewProviders ?? [])]
    )(directiveDefinition);
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
    const ngOnChangesOld = (hasInputs
      ? componentType.prototype.ngOnChanges
      : componentType.prototype.ngOnInit) as Function;
    const ngOnDestroyOld = componentType.prototype.ngOnDestroy as Function;
    componentType.prototype.ngOnDestroy = function (this: KairoDirectiveInstance) {
      this.ɵɵzone.runOutsideAngular(() => {
        this.ɵɵkairoDetachFn?.(); // issue: it might be undefined (in test)
      });
      ngOnDestroyOld?.call(this);
    };

    const onChangesOrOnInit = function (
      this: KairoDirectiveInstance,
      changes: SimpleChanges
    ) {
      if (!this.ɵɵinit) {
        if (typeof this.ngSetup !== 'function') {
          console.error(`ngSetup is not declared.`);
          return;
        }
        const changeDetector = this.ɵɵinjector.get(ChangeDetectorRef);
        const scope = new Scope(this.ɵɵkairoParentScope?.scope);
        this.ɵɵkairoScope.scope = scope;
        this.ɵɵzone.runOutsideAngular(() => {
          const endScope = scope.beginScope();
          provide(NG_INJECTOR, this.ɵɵinjector);
          Object.assign(
            this,
            (() => {
              const resolve = this.ngSetup(this, (thunk: Function) => {
                const [beh, setbeh] = mutValue(thunk(this));
                this.ɵɵchangesHook.push((instance: unknown) => {
                  setbeh(thunk(instance));
                });
                return beh;
              });
              if (resolve === undefined) {
                return {};
              }
              if (typeof resolve !== 'object') {
                throw Error(
                  `ngSetup() is expected to return an object, but it got ${typeof resolve}`
                );
              }
              for (const [key, value] of Object.entries(resolve)) {
                if (isCell(value)) {
                  effect(() =>
                    value.watch((updatedValue) => {
                      this[key] = updatedValue;
                      changeDetector.markForCheck();
                    })
                  );
                  resolve[key] = value.value;
                } else if (value instanceof Reference) {
                  this.ɵɵreferenceMap.push({
                    name: key,
                    reference: value,
                  });
                } else if (typeof value === 'function') {
                  resolve[key] = action(value as any);
                } else {
                  resolve[key] = value;
                }
              }
              return resolve;
            })()
          );
          endScope();
        });
        this.ɵɵinit = true;
      } else {
        this.ɵɵzone.runOutsideAngular(() => {
          transaction(() => {
            this.ɵɵchangesHook.forEach((x) => x(this));
          });
        });
      }
      ngOnChangesOld?.apply(this, changes);
    };

    if (hasInputs) componentType.prototype.ngOnChanges = onChangesOrOnInit;
    else componentType.prototype.ngOnInit = onChangesOrOnInit;

    const ngAfterViewInitOld = componentType.prototype.ngAfterViewInit as Function;
    const afterViewInit = function (this: KairoDirectiveInstance) {
      for (const entry of this.ɵɵreferenceMap) {
        entry.reference.current = this[entry.name];
      }
      this.ɵɵkairoDetachFn = this.ɵɵkairoScope.scope.attach();
      ngAfterViewInitOld?.call(this);
    };
    componentType.prototype.ngAfterViewInit = afterViewInit;

    const ngAfterViewCheckedOld = componentType.prototype
      .ngAfterCheckedInit as Function;
    const afterViewChecked = function (this: KairoDirectiveInstance) {
      for (const entry of this.ɵɵreferenceMap) {
        entry.reference.current = this[entry.name];
      }
      ngAfterViewCheckedOld?.call(this);
    };
    componentType.prototype.ngAfterCheckedInit = afterViewChecked;
  };
}
