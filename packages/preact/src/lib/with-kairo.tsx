import { Reaction, collectScope, LifecycleScope, Cell } from 'kairo';
import type { Track } from 'kairo';
import {
  useContext,
  useEffect,
  useReducer,
  forwardRef as reactForwardRef,
  useState,
} from 'preact/compat';
import { h } from 'preact';
import type { FunctionComponent, RenderableProps, VNode, Ref } from 'preact';
import type { ForwardFn } from 'preact/compat';
import { KairoContext } from './context';

type Render<T> = (track: Track, props: RenderableProps<T>) => VNode<any> | null;
type RenderWithRef<R, T> = (
  track: Track,
  props: RenderableProps<T>,
  ref: Ref<R>
) => VNode<any> | null;

export function withKairo<Props>(setup: (props: Props) => Render<Props>) {
  const component: FunctionComponent<Props> = (props) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.track(($) => renderFunction($, props));
  };
  component.displayName = setup.name;
  return component;
}

export function forwardRef<Props, Ref>(
  setup: (props: Props) => RenderWithRef<Ref, Props>
) {
  const component: ForwardFn<Props, Ref> = (props, ref) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.track(($) => renderFunction($, props, ref));
  };
  component.displayName = setup.name;
  return reactForwardRef(component);
}

const inc = (x: number, _: void) => x + 1;

function useKairoComponent<Props, Render>(
  props: Props,
  setup: (props: Props) => Render
) {
  const parentContext = useContext(KairoContext);
  const [, forceUpdate] = useReducer(inc, 0);
  const [instance] = useState(() => {
    const exitScope = collectScope();
    const exitContext = parentContext.runInContext();
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
      return program((cell) => {
        const ret = cell.current;
        this.logs.push([cell, ret]);
        return ret;
      });
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
