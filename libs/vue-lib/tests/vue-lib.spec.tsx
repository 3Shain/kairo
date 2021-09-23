import { fireEvent, render } from '@testing-library/vue';
import { lifecycle, mut, reference, computed } from 'kairo';
import { withKairo } from '../src';
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

async function case1(Component: any) {
  const initCallback = jest.fn();
  const cleanCallback = jest.fn();
  const viewpropChangedCallback = jest.fn();

  const w = render(Component, {
    props: {
      initialize: initCallback,
      clean: cleanCallback,
      viewProp: 'Hello',
      viewPropChanged: viewpropChangedCallback,
    },
  });
  expect(initCallback).toBeCalledTimes(1);
  expect(cleanCallback).toBeCalledTimes(0);

  const button = w.container.querySelector('button');
  const span = w.container.querySelector('span');
  expect(w.container.querySelector('p')).toHaveTextContent('Hello');
  expect(button).toHaveTextContent('0');

  w.rerender({
    initialize: initCallback,
    clean: cleanCallback,
    viewProp: 'World',
    viewPropChanged: viewpropChangedCallback,
  });
  await nextTick();
  expect(viewpropChangedCallback).toBeCalledTimes(2);
  expect(w.container.querySelector('p')).toHaveTextContent('World');

  w.rerender({
    initialize: initCallback,
    clean: cleanCallback,
    viewProp: 'Kairo',
    viewPropChanged: viewpropChangedCallback,
  });
  await nextTick();
  expect(viewpropChangedCallback).toBeCalledTimes(3);
  expect(w.container.querySelector('p')).toHaveTextContent('Kairo');

  fireEvent.click(button, {});
  await nextTick();
  expect(button).toHaveTextContent('1');
  expect(span).toHaveTextContent('2');
  fireEvent.click(button, {});
  await nextTick();
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
  const para = reference<HTMLParagraphElement>(null);

  lifecycle(() => {
    prop.initialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      prop.clean();
    };
  });

  watchEffect(()=>{
    prop.viewProp;
    prop.viewPropChanged();
  });

  const [count, setCount] = mut(0);

  const doubled = computed(() => count.value * 2);

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

Case1.props = ['initialize', 'clean', 'viewProp', 'viewPropChanged'];

const Case1Child = withKairo<{ count: number }>((_) => {
  // const dp = useProp((x) => x.count);

  return (props) => <span>{props.count}</span>;
});

Case1Child.props = ['count'];
