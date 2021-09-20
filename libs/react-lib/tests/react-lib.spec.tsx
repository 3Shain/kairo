import { fireEvent, render, cleanup } from '@testing-library/react';
import React, { useEffect } from 'react';
import { createApp, forwardRef, registerHook, withKairo } from '../src';
import { computed, effect, lifecycle, mut, reference } from 'kairo';
import '@testing-library/jest-dom';

const KairoApp = createApp((x) =>
  x.add(() => {
    return {};
  })
);

describe('@kairo/react', () => {
  beforeEach(async () => {});

  it('implement Simple Component Model', () => {
    const initCallback = jest.fn();
    const cleanCallback = jest.fn();
    const viewpropChangedCallback = jest.fn();

    const w = render(
      <KairoApp>
        <Case1
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'Hello'}
          viewPropChanged={viewpropChangedCallback}
        />
      </KairoApp>
    );
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(0);

    const button = w.container.querySelector('button');
    const span = w.container.querySelector('span');
    expect(w.container.querySelector('p')).toHaveTextContent('Hello');
    expect(button).toHaveTextContent('0');

    w.rerender(
      <KairoApp>
        <Case1
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'World'}
          viewPropChanged={viewpropChangedCallback}
        />
      </KairoApp>
    );
    expect(viewpropChangedCallback).toBeCalledTimes(1);
    expect(w.container.querySelector('p')).toHaveTextContent('World');

    w.rerender(
      <KairoApp>
        <Case1
          intialize={initCallback}
          clean={cleanCallback}
          viewProp={'Kairo'}
          viewPropChanged={viewpropChangedCallback}
        />
      </KairoApp>
    );
    expect(viewpropChangedCallback).toBeCalledTimes(2);
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
  });

  it('forwardRef', () => {
    const ref = {
      current: null as HTMLDivElement,
    };

    const w = render(
      <KairoApp>
        <Case2 ref={ref} />
      </KairoApp>
    );

    expect(ref.current).toHaveTextContent('TARGET');

    w.unmount();
  });

  it('registerHook', () => {
    const initCallback = jest.fn();
    const cleanCallback = jest.fn();

    const w = render(
      <Case3 onmount={initCallback} onunmount={cleanCallback} />
    );
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(0);

    w.unmount();
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(1);
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
}>((prop, useProp) => {
  const para = reference<HTMLParagraphElement>(null);

  lifecycle(() => {
    prop.intialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  const viewProp = useProp((x) => x.viewProp);
  effect(() => {
    viewProp.value, prop.viewPropChanged();
  });

  const [count, setCount] = mut(0);
  const add = () => {
    setCount(count.value + 1);
  };

  const doubled = computed(() => count.value * 2);

  return (vp) => (
    <div>
      <p ref={para.bind}>{vp.viewProp}</p>
      <button onClick={add}>{count.value}</button>
      <Case1Child count={doubled.value} />
    </div>
  );
});

const Case1Child = withKairo<{ count: number }>((_, useProp) => {
  const dp = useProp((x) => x.count);

  return () => <span>{dp.value}</span>;
});

const Case2 = forwardRef<{}, HTMLDivElement>(() => {
  return (_, ref) => <div ref={ref}>TARGET</div>;
});

const Case3 = withKairo<{
  onmount: Function;
  onunmount: Function;
}>(() => {
  registerHook(({ onmount, onunmount }) => {
    useEffect(() => {
      onmount();
      return () => {
        onunmount();
      };
    });
  });

  return (_) => null;
});
