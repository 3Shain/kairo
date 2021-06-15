import { render } from '@testing-library/react';
import { TestComponent, UpdateProps } from './TestComponent';
import React from 'react';
import { KairoApp } from '../src';

describe('@kairo/react', () => {
  beforeEach(async () => {});

  it('should create the app', () => {
    const result = render(
      <KairoApp>
        <TestComponent />
      </KairoApp>
    );
    expect(result.container).toBeTruthy();
    expect(result.container.firstChild.textContent).toEqual('12345');
  });

  it('should update the prop', () => {
    const result = render(
      <KairoApp>
        <UpdateProps prop={12345} />
      </KairoApp>
    );
    expect(result.container).toBeTruthy();
    expect(result.container.firstChild.textContent).toEqual('12345');

    result.rerender(
      <KairoApp>
        <UpdateProps prop={54321} />
      </KairoApp>
    );

    expect(result.container.firstChild.textContent).toEqual('54321');
  });
  // it('should render title', () => {

  // });
});
