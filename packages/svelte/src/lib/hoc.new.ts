import { SvelteComponentDev
,set_current_component,
get_current_component } from "svelte/internal";

export function withHoc<T extends typeof SvelteComponentDev>(Component:T):T {
    class HocComponent extends Component {
        constructor(options:any) {
            const parent_component: SvelteComponentDev = get_current_component();
            let oldctx:any;
            if(parent_component) {
                oldctx = parent_component.$$.context;
                parent_component.$$.context = new Map([...oldctx, /** TO INJECT */]);
            } else {
                options.context = new Map([...options.context,/** TO INJECT */])
            }
            // setup reactive scope
            super({
                ...options
            });
            if(parent_component) {
                parent_component.$$.context = oldctx;
            }
            this.$$.on_mount.push(()=>{ });
            this.$$.on_destroy.push(()=>{ });

            // this.$$.fragment
            // FEATURE: listen on anchor to inspect kairo element context lookup
        }
    }
    return HocComponent;
}

// export function withServerHoc<T extends typeof SvelteComponentDev>(Component: T):T {
//     const { render, $$render } = Component as { render: ()=>, $$render: ()=> };
//     return Component;
// }