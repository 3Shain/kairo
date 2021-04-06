
import { Ref, watch } from "vue";

// export function refToBehavior<T>(ref: Ref<T>, options?: {
//     flush: 'sync' | 'pre' | 'post'
// }) {
//     const [behavior, setBehavior] = data(ref.value);
//     watch(ref, (value) => {
//         // transaction! async or immediate
//         setBehavior(value);
//     }, options);
//     return behavior;
// }

// export function reactiveToBehavior<T>() {

// }

export function useKairo<Bindings>(
    context: () => Bindings
) {

}