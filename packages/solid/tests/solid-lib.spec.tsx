import { render, cleanup, fireEvent } from 'solid-testing-library';
import '@testing-library/jest-dom';
import { withConcern, withKairo } from '../src';
import { computed, lifecycle, mut, reference } from 'kairo';
import { createComputed, createSignal } from 'solid-js';

describe('@kairo/solid', () => {
  it('implement Simple Component Model', () => {
    const initCallback = jest.fn();
    const cleanCallback = jest.fn();
    const viewpropChangedCallback = jest.fn();

    const [signal, setSignal] = createSignal('Hello');

    const WithConcern = withConcern(() => {})(Case1);

    const w = render(() => (
      <WithConcern
        intialize={initCallback}
        clean={cleanCallback}
        viewProp={signal()}
        viewPropChanged={viewpropChangedCallback}
      />
    ));
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(0);

    const button = w.container.querySelector('button');
    const span = w.container.querySelector('span');
    expect(w.container.querySelector('p')).toHaveTextContent('Hello');
    expect(button).toHaveTextContent('0');

    setSignal('World');
    expect(viewpropChangedCallback).toBeCalledTimes(2);
    expect(w.container.querySelector('p')).toHaveTextContent('World');

    setSignal('Kairo');
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
  const [para, bindPara] = reference<HTMLParagraphElement>(null);

  lifecycle(() => {
    prop.intialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  const [count, setCount] = mut(0);

  const doubled = computed(($) => $(count) * 2);

  return ($, vp) => {
    createComputed(() => {
      vp.viewProp;
      vp.viewPropChanged();
    });
    return (
      <div>
        <p ref={bindPara}>{vp.viewProp}</p>
        <button
          onClick={() => {
            setCount(count.current + 1);
          }}
        >
          {$(count)}
        </button>
        <Case1Child count={$(doubled)} />
      </div>
    );
  };
});

const Case1Child = withKairo<{ count: number }>(() => {
  return (_, props) => <span>{props.count}</span>;
});
