/* istanbul ignore file: compiler generated code */

import {
  SvelteComponent,
  create_component,
  destroy_component,
  init,
  assign,
  mount_component,
  get_spread_update,
  get_spread_object,
  not_equal,
  transition_in,
  transition_out,
  claim_component,
  SvelteComponentDev,
  create_ssr_component,
  validate_component,
  exclude_internal_props,
} from 'svelte/internal';

export function createComponent(
  fn: () => void,
  Component: typeof SvelteComponentDev
) {
  function instance($$self: SvelteComponent, $$props: any, $$invalidate: any) {
    fn();
    $$self.$$set = ($$new_props) => {
      $$invalidate(
        0,
        ($$props = assign(
          assign({}, $$props),
          exclude_internal_props($$new_props)
        ))
      );
    };

    $$props = exclude_internal_props($$props);
    return [$$props];
  }

  function create_fragment(ctx: any) {
    let current: boolean;

    const c_spread_levels = [/*$$props*/ ctx[0]];
    let c_props = {};

    for (let i = 0; i < c_spread_levels.length; i += 1) {
      c_props = assign(c_props, c_spread_levels[i]);
    }

    const c = new Component({
      props: c_props,
      $$inline: true /* incase dev mode */,
    } as any);

    return {
      c() {
        create_component(c.$$.fragment);
      },
      l(nodes) {
        claim_component(c.$$.fragment, nodes);
      },
      m(target, anchor) {
        mount_component(c, target, anchor, undefined);
        current = true;
      },
      p(ctx, [dirty]) {
        const c_changes =
          dirty & /*$$props*/ 1
            ? get_spread_update(c_spread_levels, [
                get_spread_object(/*$$props*/ ctx[0]),
              ])
            : {};

        c.$set(c_changes);
      },
      i(local) {
        if (current) return;
        transition_in(c.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(c.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        destroy_component(c, detaching);
      },
    };
  }
  return (class KairoHoC extends SvelteComponent {
    constructor(options: any) {
      super();
      init(this, options, instance, create_fragment, not_equal, {});
    }
  } as unknown) as typeof Component;
}

export function createSSRComponent(
  fn: () => void,
  Component: typeof SvelteComponentDev
) {
  return (create_ssr_component(($$result: any, $$props: any) => {
    fn();
    return `${validate_component(Component, Component.name).$$render(
      $$result,
      Object.assign($$props),
      {},
      {}
    )}`;
  }) as unknown) as typeof Component;
}
