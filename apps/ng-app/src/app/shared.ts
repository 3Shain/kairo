import { stream } from 'kairo';

export function Counter() {
    const [plusEvent, plus] = stream<number>();

    const count = plusEvent.reduce((a, b) => a + b, 0);

    return {
        count,
        plus,
    };
}
