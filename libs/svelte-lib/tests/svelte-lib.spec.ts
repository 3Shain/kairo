import { render, cleanup, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import Case1 from './Case1.svelte';
import { tick } from 'svelte';
import { withConcern } from '../src';
import { lifecycle } from 'kairo';

describe('@kairo/svelte', () => {
  it('implement Simple Component Model', async () => {
    const initCallback = jest.fn();
    const cleanCallback = jest.fn();
    const viewpropChangedCallback = jest.fn();

    const appInitCallback = jest.fn();
    const appCleanCallback = jest.fn();

    const App = withConcern(() => {
      lifecycle(() => {
        appInitCallback();
        return () => appCleanCallback();
      });
      return {};
    }, Case1);

    const w = render(App, {
      initialize: initCallback,
      clean: cleanCallback,
      viewProp: 'Hello',
      viewPropChanged: viewpropChangedCallback,
    });
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(0);
    expect(appInitCallback).toBeCalledTimes(1);
    expect(appCleanCallback).toBeCalledTimes(0);

    const button = w.container.querySelector('button');
    const span = w.container.querySelector('span');
    expect(w.container.querySelector('p')).toHaveTextContent('Hello');
    expect(button).toHaveTextContent('0');

    w.component.$set({
      initialize: initCallback,
      clean: cleanCallback,
      viewProp: 'World',
      viewPropChanged: viewpropChangedCallback,
    });
    await tick();
    expect(w.container.querySelector('p')).toHaveTextContent('World');
    expect(viewpropChangedCallback).toBeCalledTimes(2);

    w.component.$set({
      initialize: initCallback,
      clean: cleanCallback,
      viewProp: 'Kairo',
      viewPropChanged: viewpropChangedCallback,
    });
    await tick();
    expect(viewpropChangedCallback).toBeCalledTimes(3);
    expect(w.container.querySelector('p')).toHaveTextContent('Kairo');

    await fireEvent.click(button, {});
    expect(button).toHaveTextContent('1');
    expect(span).toHaveTextContent('2');
    await fireEvent.click(button, {});
    expect(button).toHaveTextContent('2');
    expect(span).toHaveTextContent('4');

    w.unmount();
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(1);
    expect(appInitCallback).toBeCalledTimes(1);
    expect(appCleanCallback).toBeCalledTimes(1);
  });

  afterEach(() => {
    cleanup();
  });
});
