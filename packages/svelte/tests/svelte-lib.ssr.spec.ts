import '@testing-library/jest-dom';
import Case1 from './Case1.svelte';
import { withConcern } from '../src';
import { lifecycle } from 'kairo';
import { Observable } from 'rxjs';

describe('@kairo/svelte in ssr mode', () => {
  beforeEach(() => {
    globalThis.Observable = Observable;
  });
  afterEach(() => {
    globalThis.Observable = undefined;
  });
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
    }, Case1) as unknown as {
      render: (props: any) => {
        html: string;
        css: {
          code: string;
          map: any;
        };
        head: string;
      };
    };

    const {html} = App.render({
        initialize: initCallback,
        clean: cleanCallback,
        viewProp: 'Hello',
        viewPropChanged: viewpropChangedCallback,
    });

    expect(initCallback).toBeCalledTimes(0);
    expect(cleanCallback).toBeCalledTimes(0);
    expect(viewpropChangedCallback).toBeCalledTimes(1); // ? is expected
    expect(appInitCallback).toBeCalledTimes(0);
    expect(appCleanCallback).toBeCalledTimes(0);

    const dom = document.createElement('div');
    dom.innerHTML = html;

    expect(dom.firstChild).toBeInstanceOf(HTMLDivElement);
    expect(dom.firstChild.firstChild).toBeInstanceOf(HTMLParagraphElement);
    expect(dom.firstChild.firstChild).toHaveTextContent('Hello');
    expect(dom.firstChild.lastChild).toBeInstanceOf(HTMLSpanElement);
    expect(dom.firstChild.lastChild).toHaveTextContent('0');

  });
});
