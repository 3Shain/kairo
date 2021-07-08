import { fireEvent, render, cleanup } from '@testing-library/preact';
import { createKairoApp, withKairo } from '../src';
import { effect, mut, reference } from 'kairo';
import '@testing-library/jest-dom';
import { h } from 'preact';

const { App: KairoApp } = createKairoApp();

describe('@kairo/preact', () => {

  it('implement Simple Component Model', () => {
    const initCallback = jest.fn();
    const cleanCallback = jest.fn();
    const viewpropChangedCallback = jest.fn();

    const w = render(
      <KairoApp globalSetup={() => {}}>
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
      <KairoApp globalSetup={() => {}}>
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
      <KairoApp globalSetup={() => {}}>
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

  effect(() => {
    prop.intialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  const viewProp = useProp((x) => x.viewProp);
  effect(() =>
    viewProp.watch(() => {
      prop.viewPropChanged();
    })
  );

  const [count, setCount] = mut(0);

  const doubled = count.map((x) => x * 2);

  return (vp) => (
    <div>
      <p ref={para.bind}>{vp.viewProp}</p>
      <button
        onClick={() => {
          setCount(count.value + 1);
        }}
      >
        {count.value}
      </button>
      <Case1Child count={doubled.value} />
    </div>
  );
});

const Case1Child = withKairo<{ count: number }>((_, useProp) => {
  const dp = useProp((x) => x.count);

  return () => <span>{dp.value}</span>;
});

/**
 * chilren: cascaded dependency injection.
 */