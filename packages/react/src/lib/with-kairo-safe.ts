import {
  Reaction,
  collectScope,
  LifecycleScope,
  Cell,
  CONCERN_HOC_FACTORY,
  UNSTABLE_isCellCurrentEqualTo,
  lifecycle,
  EffectScope,
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

  const [, forceUpdate] = useReducer(inc, 0);

  const [[track, renderFn, scope, effectQueue]] = useState(() => {
    const exitScope = collectScope();
    const exitContext = parentContext
      .inherit({
        [CONCERN_HOC_FACTORY]: withConcern,
      })
      .runInContext();
    let reaction: Reaction = new Reaction(forceUpdate);
    lifecycle(() => () => reaction.dispose()); // https://github.com/reactwg/react-18/discussions/18
    // won't non-symmetric operation make troubles?
    let renderFunction: Render;
    let scope: LifecycleScope;
    try {
      renderFunction = setup(props);
    } finally {
      exitContext();
      scope = exitScope();
    }
    const effectQueue = [];

    const dscope = new EffectScope({
      schedule: (callback)=>{
        effectQueue.push(callback);
      }
    });

    return [reaction.track, renderFunction, scope, effectQueue] as const;
  });

  useEffect(() => scope.attach(), []);

  const [result, readLogs] = useTrack(renderFn as any, props, ...args);
  useLayoutEffect(()=>{
    const dio = effectQueue.map(s=>s());
    effectQueue.length = 0;
    return ()=> dio.forEach(x=>x());
  });
  useLayoutEffect(
    () =>
      track(($) => {
        let tearing = false;
        for (let i = 0; i < readLogs.length; i += 3) {
          $(readLogs[i]); // log deps
          tearing =
            tearing ||
            !UNSTABLE_isCellCurrentEqualTo(
              readLogs[i],
              readLogs[i + 1],
              readLogs[i + 2]
            );
        }
        if (tearing) forceUpdate();
      }),
    // TODO: optimizable dependency list?
    // desired: [...props] but props is not a stable object...
    // desired: [...readLogs] but the length varies
    [props, ...args]
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
  const getSnapshot = useCallback(() => {
    return cell();
  }, [cell]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// TODO: correct types
function useTrack<T>(program: ($: Track, ...args: any[]) => T, ...args: any[]) {
  const logs = [];
  const track = (cell: Cell<any>) => {
    const ret = cell();
    logs.push(cell, ret, false);
    return ret;
  };
  Object.defineProperty(track, 'error', {
    value: (cell: Cell<any>) => {
      try {
        cell();
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
