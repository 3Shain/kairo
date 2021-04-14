import { Injectable, OnDestroy } from "@angular/core";
import { disposeScope, Scope, scopedWith, inject } from "kairo";

@Injectable()
export class KairoScope implements OnDestroy {

    public scope: Scope;

    constructor() { }

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