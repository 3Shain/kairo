import { fireEvent, render } from '@testing-library/vue';
import { lifecycle, mut, reference, computed } from 'kairo';
import { withConcern, withKairo } from '../src';
import '@testing-library/jest-dom';
import { nextTick, watchEffect } from 'vue';
import Case1SFC from './Case1.vue';
import Case1SetupSFC from './Case1Setup.vue';
import KeepAlive from './KeepAlive.vue';

describe('@kairo/vue', () => {
  it('implement Simple Component Model (jsx)', async () => {
    await case1(Case1);
  });

  it('implement Simple Component Model (sfc)', async () => {
    await case1(Case1SFC);
  });

  it('implement Simple Component Model (sfc-setup)', async () => {
    await case1(Case1SetupSFC);
  });

  it('keepalive', async () => {
    const w = render(KeepAlive, {
      props: {
        show: true,
      },
    });

    await nextTick();
    w.rerender({
      show: false,
    });

    await nextTick();
    w.rerender({
      show: true,
    });

    await nextTick();
    w.rerender({
      show: false,
    });

    await nextTick();
    w.rerender({
      show: true,
    });
    w.unmount();
  });
});

async function case1(cComponent: any) {
  const Component = withConcern(() => {}, cComponent);

  const initCallback = jest.fn();
  const cleanCallback = jest.fn();
  const viewpropChangedCallback = jest.fn();

  const w = render(Component, {
    props: {
      initialize: initCallback,
      clean: cleanCallback,
      viewProp: 'Hello',
      viewPropChanged: viewpropChangedCallback,
      onEvent: (vtt) => {},
    },
  });
  expect(initCallback).toBeCalledTimes(1);
  expect(cleanCallback).toBeCalledTimes(0);

  const button = w.container.querySelector('button');
  const span = w.container.querySelector('span');
  expect(w.container.querySelector('p')).toHaveTextContent('Hello');
  expect(button).toHaveTextContent('0');

  await w.rerender({
    initialize: initCallback,
    clean: cleanCallback,
    viewProp: 'World',
    viewPropChanged: viewpropChangedCallback,
  });
  expect(viewpropChangedCallback).toBeCalledTimes(2);
  expect(w.container.querySelector('p')).toHaveTextContent('World');

  await w.rerender({
    initialize: initCallback,
    clean: cleanCallback,
    viewProp: 'Kairo',
    viewPropChanged: viewpropChangedCallback,
  });
  expect(viewpropChangedCallback).toBeCalledTimes(3);
  expect(w.container.querySelector('p')).toHaveTextContent('Kairo');

  await fireEvent.click(button, {});
  // await nextTick();
  expect(button).toHaveTextContent('1');
  expect(span).toHaveTextContent('2');
  await fireEvent.click(button, {});
  expect(button).toHaveTextContent('2');
  expect(span).toHaveTextContent('4');

  w.unmount();
  expect(initCallback).toBeCalledTimes(1);
  expect(cleanCallback).toBeCalledTimes(1);
}

export const Case1 = withKairo<{
  initialize: Function;
  clean: Function;
  viewProp: string;
  viewPropChanged: Function;
}>((prop) => {
  const [para, _para] = reference<HTMLParagraphElement>(null);

  lifecycle(() => {
    prop.initialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  watchEffect(() => {
    prop.viewProp;
    prop.viewPropChanged();
  });

  const [count, setCount] = mut(0);

  const doubled = computed(() => count.$ * 2);

  return (vp) => (
    <div>
      <p ref={_para.bind}>{vp.viewProp}</p>
      <button
        onClick={() => {
          setCount((x) => x + 1);
        }}
      >
        {count.$}
      </button>
      <Case1Child count={doubled.$} />
    </div>
  );
});

Case1.props = ['initialize', 'clean', 'viewProp', 'viewPropChanged'];

const Case1Child = withKairo<{ count: number }>((_) => {
  return (props) => <span>{props.count}</span>;
});

Case1Child.props = ['count'];
