import { fireEvent, render, cleanup, act } from '@testing-library/react';
import React, { useEffect } from 'react';
import { forwardRef, withKairo, withConcern, ConcurrentMode } from '../src';
import { computed, lifecycle, mut, reference } from 'kairo';
import '@testing-library/jest-dom';

const [freeCell, setFreeCell] = mut(0);

describe('@kairo/react in concurrent mode', () => {
  beforeEach(async () => {});

  it('normal API should implement Simple Component Model', () => {
    const initCallback = jest.fn();
    const cleanCallback = jest.fn();
    const viewpropChangedCallback = jest.fn();

    const appInit = jest.fn();
    const appClean = jest.fn();

    const Case1Concern = withConcern(() => {
      lifecycle(() => {
        appInit();
        return appClean;
      });
    })(Case1);

    const w = render(
      <React.StrictMode>
        <Case1Concern
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'Hello'}
          viewPropChanged={viewpropChangedCallback}
        />
      </React.StrictMode>,
      {}
    );
    // because of StrictEffects https://github.com/reactwg/react-18/discussions/19
    // useEffect will be called twice. The behavior is mount->unmount->mount
    expect(initCallback).toBeCalledTimes(2); // TBH is it pointless to check this?
    expect(cleanCallback).toBeCalledTimes(1);
    expect(viewpropChangedCallback).toBeCalledTimes(2);

    expect(appInit).toBeCalledTimes(2);
    expect(appClean).toBeCalledTimes(1);

    const button = w.container.querySelector('button');
    const span = w.container.querySelector('span');
    const h1 = w.container.querySelector('h1');
    expect(w.container.querySelector('p')).toHaveTextContent('Hello');
    expect(button).toHaveTextContent('0');
    expect(h1).toHaveTextContent('1');

    w.rerender(
      <React.StrictMode>
        <Case1Concern
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'World'}
          viewPropChanged={viewpropChangedCallback}
        />
      </React.StrictMode>
    );
    expect(viewpropChangedCallback).toBeCalledTimes(3);
    expect(w.container.querySelector('p')).toHaveTextContent('World');

    w.rerender(
      <React.StrictMode>
        <Case1Concern
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'Kairo'}
          viewPropChanged={viewpropChangedCallback}
        />
      </React.StrictMode>
    );
    expect(viewpropChangedCallback).toBeCalledTimes(4);
    expect(w.container.querySelector('p')).toHaveTextContent('Kairo');

    fireEvent.click(button, {});
    expect(button).toHaveTextContent('1');
    expect(span).toHaveTextContent('2');
    fireEvent.click(button, {});
    expect(button).toHaveTextContent('2');
    expect(span).toHaveTextContent('4');

    w.unmount();
    expect(initCallback).toBeCalledTimes(2);
    expect(cleanCallback).toBeCalledTimes(2);

    expect(appInit).toBeCalledTimes(2);
    expect(appClean).toBeCalledTimes(2);
  });

  it('forwardRef', () => {
    const ref = {
      current: null as HTMLDivElement,
    };

    const w = render(<Case2 ref={ref} />);

    expect(ref.current).toHaveTextContent('TARGET');

    w.unmount();
  });

  it('CM API should implement Simple Component Model', () => {
    const initCallback = jest.fn();
    const cleanCallback = jest.fn();
    const viewpropChangedCallback = jest.fn();

    const appInit = jest.fn();
    const appClean = jest.fn();

    const Case1Concern = withConcern(() => {
      lifecycle(() => {
        appInit();
        return appClean;
      });
    })(Case1CM);

    const w = render(
      <React.StrictMode>
        <Case1Concern
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'Hello'}
          viewPropChanged={viewpropChangedCallback}
        />
      </React.StrictMode>,
      {}
    );
    // because of StrictEffects https://github.com/reactwg/react-18/discussions/19
    // useEffect will be called twice. The behavior is mount->unmount->mount
    expect(initCallback).toBeCalledTimes(2); // TBH is it pointless to check this?
    expect(cleanCallback).toBeCalledTimes(1);
    expect(viewpropChangedCallback).toBeCalledTimes(2);

    expect(appInit).toBeCalledTimes(2);
    expect(appClean).toBeCalledTimes(1);

    const button = w.container.querySelector('button');
    const span = w.container.querySelector('span');
    const h1 = w.container.querySelector('h1');
    expect(w.container.querySelector('p')).toHaveTextContent('Hello');
    expect(button).toHaveTextContent('0');
    expect(h1).toHaveTextContent('1');

    w.rerender(
      <React.StrictMode>
        <Case1Concern
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'World'}
          viewPropChanged={viewpropChangedCallback}
        />
      </React.StrictMode>
    );
    expect(viewpropChangedCallback).toBeCalledTimes(3);
    expect(w.container.querySelector('p')).toHaveTextContent('World');

    w.rerender(
      <React.StrictMode>
        <Case1Concern
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'Kairo'}
          viewPropChanged={viewpropChangedCallback}
        />
      </React.StrictMode>
    );
    expect(viewpropChangedCallback).toBeCalledTimes(4);
    expect(w.container.querySelector('p')).toHaveTextContent('Kairo');

    fireEvent.click(button, {});
    expect(button).toHaveTextContent('1');
    expect(span).toHaveTextContent('2');
    fireEvent.click(button, {});
    expect(button).toHaveTextContent('2');
    expect(span).toHaveTextContent('4');

    w.unmount();
    expect(initCallback).toBeCalledTimes(2);
    expect(cleanCallback).toBeCalledTimes(2);

    expect(appInit).toBeCalledTimes(2);
    expect(appClean).toBeCalledTimes(2);
  });

  it('CM API forwardRef', () => {
    const ref = {
      current: null as HTMLDivElement,
    };

    const w = render(<Case2CM ref={ref} />);

    expect(ref.current).toHaveTextContent('TARGET');

    w.unmount();
  });


  afterAll(() => {
    cleanup();
  });
});

export const Case1 = withKairo<{
  intialize: Function;
  clean: Function;
  viewProp: string;
  viewPropChanged: Function;
}>((prop) => {
  const [para, _para] = reference<HTMLParagraphElement>(null);

  lifecycle(() => {
    debugger;
    prop.intialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  const [count, setCount] = mut(0);
  const add = () => {
    setCount((x) => x + 1);
  };

  const doubled = computed(($) => $(count) * 2);

  return ($, { viewProp, viewPropChanged }) => {
    useEffect(() => viewPropChanged(), [viewProp]);
    return (
      <div>
        <p ref={_para.bind}>{viewProp}</p>
        <button onClick={add}>{$(count)}</button>
        <h1>{$(freeCell)}</h1>
        <Case1Child count={$(doubled)} />
      </div>
    );
  };
});

const Case1Child = withKairo<{ count: number }>(() => {
  return (_, { count }) => {
    useEffect(() => {
      setFreeCell(1);
    }, []);
    return <span>{count}</span>;
  };
});

const Case2 = forwardRef<{}, HTMLDivElement>(() => {
  return (_, __, ref) => <div ref={ref}>TARGET</div>;
});

export const Case1CM = ConcurrentMode.withKairo<{
  intialize: Function;
  clean: Function;
  viewProp: string;
  viewPropChanged: Function;
}>((prop) => {
  const [para, _para] = reference<HTMLParagraphElement>(null);

  lifecycle(() => {
    prop.intialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  const [count, setCount] = mut(0);
  const add = () => {
    setCount((x) => x + 1);
  };

  const doubled = computed(($) => $(count) * 2);

  return (useCell, { viewProp, viewPropChanged }) => {
    useEffect(() => viewPropChanged(), [viewProp]);
    const count_ = useCell(count);
    const freeCell_ = useCell(freeCell);
    const doubled_ = useCell(doubled);
    // debugger;
    return (
      <div>
        <p ref={_para}>{viewProp}</p>
        <button onClick={add}>{count_}</button>
        <h1>{freeCell_}</h1>
        <Case1Child count={doubled_} />
      </div>
    );
  };
});

const Case2CM = ConcurrentMode.forwardRef<{}, HTMLDivElement>(() => {
  return (useCell, __, ref) => {

    useCell(freeCell);

    return <div ref={ref}>TARGET</div>
  };
});