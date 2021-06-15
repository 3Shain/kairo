import { mount } from '@vue/test-utils';
import TestComponent from './TestComponent.vue';
import { JSXComponent } from './TestJSXComponent';

describe('@kairo/vue', () => {
  it('should create the app', () => {
    const wrapper = mount(TestComponent);
    expect(wrapper).toBeTruthy();
  });

  it('should create the app (jsx)', () => {
    const wrapper = mount(JSXComponent);
    expect(wrapper).toBeTruthy();
  });
});
