import {
  Reaction,
  collectScope,
  LifecycleScope,
  Cell,
  CONCERN_HOC_FACTORY,
  UNSTABLE_isCellCurrentEqualTo,
} from 'kairo';
import type { Track } from 'kairo';
import React, {
  useContext,
  useEffect,
  forwardRef as reactForwardRef,
  useState,
  useCallback,
  useLayoutEffect,
  useReducer,
} from 'react';
import { KairoContext } from './context';
import { withConcern } from './application';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

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
    return useKairoComponent(props, setup);
  };
  KairoComponent.displayName = setup.name;
  return KairoComponent;
}

export function forwardRef<Props, Ref>(
  setup: (props: Props) => RenderWithRef<Ref, Props>
) {
  const KairoForwardRef: React.ForwardRefRenderFunction<Ref, Props> = (
    props,
    ref
  ) => {
    return useKairoComponent(props, setup, ref);
  };
  KairoForwardRef.displayName = setup.name;
  return reactForwardRef(KairoForwardRef);
}

const inc = (x: number) => x + 1;

function useKairoComponent<Props, Render extends Function>(
  props: Props,
  setup: (props: Props) => Render,
  ...args: any[]
) {
  const parentContext = useContext(KairoContext);

  const [[subscribe, getVersion, track, renderFn, scope]] = useState(() => {
    const exitScope = collectScope();
    const exitContext = parentContext
      .inherit({
        [CONCERN_HOC_FACTORY]: withConcern,
      })
      .runInContext();
    let renderFunction: Render;
    let scope: LifecycleScope;
    try {
      renderFunction = setup(props);
    } finally {
      exitContext();
      scope = exitScope();
    }
    let version = 0;
    let reaction: Reaction | null = null;
    const subscribe = (onchange: any) => {
      reaction = new Reaction(() => {
        version++;
        onchange();
      });
      return () => {
        reaction.dispose();
        reaction = null;
      };
    };
    const getVersion = () => version;
    const track = <T>(program: ($: Track) => T) => reaction!.track(program);

    return [subscribe, getVersion, track, renderFunction, scope] as const;
  });

  useEffect(() => scope.attach(), []);

  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  const [result, readLogs] = useTrack(renderFn as any, props, ...args);

  const [, forceUpdate] = useReducer(inc, 0);

  // TODO: switch to useLayoutEffect? seems not work with uSES
  useEffect(
    () =>
      track(($) => {
        let bailout = false;
        for (let i = 0; i < readLogs.length; i += 3) {
          $(readLogs[i]); // log deps
          bailout =
            bailout ||
            !UNSTABLE_isCellCurrentEqualTo(readLogs[i], readLogs[i + 1], readLogs[i + 2]);
        }
        if (bailout) forceUpdate();
      }),
    // TODO: optimizable dependency list?
    // desired: [id,...props] but props is not a stable object...
    // desired: [...readLogs] but the length varies
    [version, props, ...args]
    // it's abnormal to use the whole props object as dependency (almost useless?)
    // but seems like it could skip `forceUpdate`
  );

  return result;
}

export function useCell<T>(cell: Cell<T>) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const reaction = new Reaction(onChange);
      reaction.track(($) => $(cell));
      return () => reaction.dispose();
    },
    [cell]
  );
  return useSyncExternalStore(
    subscribe,
    () => cell.current,
    () => cell.current
  );
}

// TODO: correct types
function useTrack<T>(program: ($: Track, ...args: any[]) => T, ...args: any[]) {
  const logs = [];
  const track = (cell: Cell<any>) => {
    const ret = cell.current;
    logs.push(cell, ret, false);
    return ret;
  };
  Object.defineProperty(track, 'error', {
    value: (cell: Cell<any>) => {
      try {
        cell.current;
        logs.push(cell, null, true);
        return null;
      } catch (e) {
        logs.push(cell, e, true);
        return e;
      }
    },
  }); // TODO: support suspended?
  return [program(track as any, ...args), logs];
}
