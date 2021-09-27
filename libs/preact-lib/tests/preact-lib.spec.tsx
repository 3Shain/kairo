import { fireEvent, render, cleanup } from '@testing-library/preact';
import { withConcern, withKairo, forwardRef } from '../src';
import { lifecycle, computed, mut, reference } from 'kairo';
import '@testing-library/jest-dom';
import { h } from 'preact';
import { useEffect } from 'preact/compat';

describe('@kairo/preact', () => {
  it('implement Simple Component Model', () => {
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
    }, Case1);

    const w = render(
      <Case1Concern
        intialize={initCallback}
        clean={cleanCallback}
        viewProp={'Hello'}
        viewPropChanged={viewpropChangedCallback}
      />
    );
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(0);
    expect(viewpropChangedCallback).toBeCalledTimes(1);

    expect(appInit).toBeCalledTimes(1);
    expect(appClean).toBeCalledTimes(0);

    const button = w.container.querySelector('button');
    const span = w.container.querySelector('span');
    expect(w.container.querySelector('p')).toHaveTextContent('Hello');
    expect(button).toHaveTextContent('0');

    w.rerender(
      <Case1Concern
        intialize={initCallback}
        clean={cleanCallback}
        viewProp={'World'}
        viewPropChanged={viewpropChangedCallback}
      />
    );
    expect(viewpropChangedCallback).toBeCalledTimes(2);
    expect(w.container.querySelector('p')).toHaveTextContent('World');

    w.rerender(
      <Case1Concern
        intialize={initCallback}
        clean={cleanCallback}
        viewProp={'Kairo'}
        viewPropChanged={viewpropChangedCallback}
      />
    );
    expect(viewpropChangedCallback).toBeCalledTimes(3);
    expect(w.container.querySelector('p')).toHaveTextContent('Kairo');

    fireEvent.click(button, {});
    expect(button).toHaveTextContent('1');
    expect(span).toHaveTextContent('2');
    fireEvent.click(button, {});
    expect(button).toHaveTextContent('2');
    expect(span).toHaveTextContent('4');

    w.unmount();
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(1);

    expect(appInit).toBeCalledTimes(1);
    expect(appClean).toBeCalledTimes(1);
  });

  it('forwardRef', () => {
    const ref = {
      current: null as HTMLDivElement,
    };

    const w = render(<Case2 ref={ref} />);

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
  const para = reference<HTMLParagraphElement>(null);

  lifecycle(() => {
    prop.intialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  const [count, setCount] = mut(0);
  const add = () => {
    setCount(count.value + 1);
  };

  const doubled = computed(() => count.value * 2);

  return ({ viewProp, viewPropChanged }) => {
    useEffect(() => viewPropChanged(), [viewProp]);
    return (
      <div>
        <p ref={para.bind}>{viewProp}</p>
        <button onClick={add}>{count.value}</button>
        <Case1Child count={doubled.value} />
      </div>
    );
  };
});

const Case1Child = withKairo<{ count: number }>(() => {
  return (vp) => <span>{vp.count}</span>;
});

const Case2 = forwardRef<{}, HTMLDivElement>(() => {
  return (_, ref) => <div ref={ref}>TARGET</div>;
});
