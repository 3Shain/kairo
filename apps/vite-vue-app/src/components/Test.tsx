import { withKairo } from '@kairo/vue';
import { renderSlot } from 'vue';
import {
    mutable as data,
    readEvents,
    stream,
    task,
    merge,
    nextFrame,
    animation,
    debounce,
    throttle,
    asap,
} from 'kairo';
import './Test.css';

const Component = withKairo<{
    test: number;
}>((_, useprop) => {
    const [position, setPosition] = data([0, 0]);

    const prop = useprop((x) => x.test);

    // prop.watch(console.log);

    let ref: HTMLDivElement | null = null;

    const [mouseup, onmouseup] = stream<MouseEvent>(),
        [mousemove, onmousemove] = stream<MouseEvent>(),
        [mouseleave, onmouseleave] = stream<MouseEvent>();

    position.changes(animation).listen(([x, y]) => {
        // console.log(ref);
        if (ref) ref.style.transform = `translate3d(${x}px,${y}px,0px)`;
    });

    const dnd = task(function* (e: MouseEvent) {
        let [x, y] = position.value;
        let lastMv = e;
        const channel = readEvents({
            from: mousemove,
            until: merge([mouseup, mouseleave]),
        });
        while (yield* channel.hasNext()) {
            const mv = yield* channel.next();
            x += mv.clientX - lastMv.clientX;
            y += mv.clientY - lastMv.clientY;
            lastMv = mv;
            setPosition(radius(x, y, 50));
        }
        [x, y] = position.value; //...
        let frameTotal = Math.floor(Math.sqrt(x * x + y * y) / 2);
        let framePass = 0;
        while (framePass < frameTotal) {
            framePass++;
            setPosition(interpolate2d(x, y, 1 - framePass / frameTotal));
            yield* nextFrame();
        }
    });

    return ({ children }) => (
        <div>
            {children}
            <p>{prop.value}</p>
            <p>{`x:${position.value[0]},y:${position.value[1]}`}</p>
            <div class="box">
                <div
                    class="stick"
                    onMouseup={onmouseup}
                    onMousedown={dnd}
                    onMousemove={onmousemove}
                    onMouseleave={onmouseleave}
                    ref={(v) => {
                        ref = v as any;
                    }}
                ></div>
                <div class="bg"></div>
            </div>
        </div>
    );
});

Component.props = ['test'];

export default Component;

function interpolate2d(x: number, y: number, step: number) {
    step = EasingFunctions.easeInCubic(step);
    if (step < 0) {
        step = 0;
    }
    return [x * step, y * step];
}

function radius(x: number, y: number, radius: number) {
    const d = x * x + y * y;
    const p = radius * radius;
    if (d <= p) {
        return [x, y];
    } else {
        const g = radius / Math.sqrt(d);
        return [x * g, y * g];
    }
}

const EasingFunctions = {
    // no easing, no acceleration
    linear: (t: number) => t,
    // accelerating from zero velocity
    easeInQuad: (t: number) => t * t,
    // decelerating to zero velocity
    easeOutQuad: (t: number) => t * (2 - t),
    // acceleration until halfway, then deceleration
    easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    // accelerating from zero velocity
    easeInCubic: (t: number) => t * t * t,
    // decelerating to zero velocity
    easeOutCubic: (t: number) => --t * t * t + 1,
    // acceleration until halfway, then deceleration
    easeInOutCubic: (t: number) =>
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    // accelerating from zero velocity
    easeInQuart: (t: number) => t * t * t * t,
    // decelerating to zero velocity
    easeOutQuart: (t: number) => 1 - --t * t * t * t,
    // acceleration until halfway, then deceleration
    easeInOutQuart: (t: number) =>
        t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
    // accelerating from zero velocity
    easeInQuint: (t: number) => t * t * t * t * t,
    // decelerating to zero velocity
    easeOutQuint: (t: number) => 1 + --t * t * t * t * t,
    // acceleration until halfway, then deceleration
    easeInOutQuint: (t: number) =>
        t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
};
