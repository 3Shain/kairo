import { Reaction, collectScope, LifecycleScope, Cell, CONCERN_HOC_FACTORY } from 'kairo';
import type { Track } from 'kairo';
import React, {
  useContext,
  useEffect,
  forwardRef as reactForwardRef,
  useReducer,
  useState,
} from 'react';
import { KairoContext } from './context';
import { withConcern } from './application';

type Render<T> = (
  track: Track,
  props: React.PropsWithChildren<T>
) => React.ReactElement<any, any> | null;
type RenderWithRef<R, T> = (
  track: Track,
  props: React.PropsWithChildren<T>,
  ref: React.ForwardedRef<R>
) => React.ReactElement<any, any> | null;

export function withKairo<Props>(setup: (props: Props) => Render<Props>) {
  const KairoComponent: React.FunctionComponent<Props> = (props) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.track(($) => renderFunction($, props));
  };
  KairoComponent.displayName = setup.name;
  return KairoComponent;
}

export function forwardRef<Props, Ref>(
  setup: (props: Props) => RenderWithRef<Ref, Props>
) {
  const KairForwardRef: React.ForwardRefRenderFunction<Ref, Props> = (
    props,
    ref
  ) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.track(($) => renderFunction($, props, ref));
  };
  KairForwardRef.displayName = setup.name;
  return reactForwardRef(KairForwardRef);
}

const inc = (x: number) => x + 1;

function useKairoComponent<Props, Render>(
  props: Props,
  setup: (props: Props) => Render
) {
  const parentContext = useContext(KairoContext);
  const [, forceUpdate] = useReducer(inc, 0);
  const [instance] = useState(() => {
    const exitScope = collectScope();
    const exitContext = parentContext.inherit({
      [CONCERN_HOC_FACTORY]: withConcern
    }).runInContext();
    let renderFunction: Render;
    let scope: LifecycleScope;
    try {
      renderFunction = setup(props);
    } finally {
      exitContext();
      scope = exitScope();
    }
    const renderReaction = new RenderReaction(forceUpdate);

    return {
      renderFunction,
      renderReaction,
      scope,
    };
  });
  useEffect(() => instance.renderReaction.mount(), []);
  useEffect(() => instance.scope.attach(), []);
  return instance;
}

class RenderReaction {
  private mounted = false;
  private logs: [Cell<any>, any][] = [];
  private _reaction: Reaction;

  constructor(private callback: () => void) {
    this._reaction = new Reaction(callback);
  }

  track<T>(program: ($: Track) => T) {
    if (this.mounted) {
      return this._reaction.track(program);
    } else {
      this.logs = [];
      const track = (cell: Cell<any>) => {
        const ret = cell.current;
        this.logs.push([cell, ret]);
        return ret;
      };
      Object.defineProperty(track, 'error', {
        value: (cell: Cell<any>) => {
          try {
            cell.current;
            this.logs.push([cell, null]);
            return null;
          } catch (e) {
            this.logs.push([cell, e]);
            return e;
          }
        },
      });
      return program(track as any);
    }
  }

  mount() {
    this.mounted = true;
    let needToRerender = false;
    this._reaction.track(($) => {
      this.logs.forEach((x) => {
        const ret = $(x[0]);
        needToRerender ||= !Object.is(ret, x[1]);
        return ret;
      });
    });
    this.logs = [];
    if (needToRerender) this.callback();
    return () => {
      this.mounted = false;
      this._reaction.dispose();
    };
  }
}
