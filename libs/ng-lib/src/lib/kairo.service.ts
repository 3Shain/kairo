import { Injectable, OnDestroy } from "@angular/core";
import { disposeScope, Scope, scopedWith, inject } from "kairo";

@Injectable()
export class KairoScope implements OnDestroy {
    constructor(
        public readonly scope: Scope
    ) { }

    useInject(token: unknown): void
    useInject(token: any) {
        scopedWith(() => {
            const injected = inject(token);
            // resolve: if cell: 
        }, this.scope);
    }

    useObservableInject() {

    }

    ngOnDestroy() {
        disposeScope(this.scope); // ?problematic call
    }
}