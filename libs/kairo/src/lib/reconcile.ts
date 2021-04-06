import { untrack } from "./core/behavior";
import { Behavior } from "./public-api";

export function reconcile<T, G>(
    cellOfArray: Behavior<Array<T>>,
    setup: (f: T) => G,
    trackBy: (v: T) => any
) {

    /**
     * 
     * List ~> Cell<List>
     */
    let current: G[] = [];

    let lastExist: Map<any, number> = new Map();

    return cellOfArray.map(
        function reconc(array) {
            const currentExist: Map<any, number> = new Map();
            if (current === null) {
                let index = 0;
                for (const entry of array) {
                    const tracker = trackBy(entry);
                    const d = untrack(() => {
                        // create context,
                        // 
                    });
                    currentExist.set(tracker, index);
                    // current!.push(d);
                    index++;
                }
            } else {
                // diff
                let index = 0;
                for (const entry of array) {
                    const tracker = trackBy(entry);
                    const record = lastExist.get(tracker);
                    if (record !== undefined) {
                        if (record !== index) {
                            // item to move
                        } else {
                            // item stay safe
                        }
                    } else {
                        // item new added.
                    }
                    currentExist.set(tracker, index);
                    index++;
                }
            }
            return current;
        }
    );
}