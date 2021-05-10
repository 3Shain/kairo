import { stream, reduced } from 'kairo';

export function Counter() {
    const [plusEvent, plus] = stream<number>();

    const count = reduced(plusEvent, (a, b) => a + b, 0);

    return {
        count,
        plus,
    };
}
