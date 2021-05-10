<script lang="ts" kairo="root">
    import {
        animation,
        effect,
        inject,
        merged,
        mutable,
        nextAnimationFrame,
        provide,
        readEvents,
        stream,
        task,
    } from 'kairo';
import Child from './Child.svelte';
import { TOKEN } from './lib';

    let ref$$: HTMLDivElement;

    const [position, setPosition] = mutable([0, 0]);

    const [mouseup, onmouseup] = stream<MouseEvent>(),
        [mousemove, onmousemove] = stream<MouseEvent>(),
        [mouseleave, onmouseleave] = stream<MouseEvent>();

    effect(() =>
        position.watch(([x, y]) => {
            if (ref$$) ref$$.style.transform = `translate3d(${x}px,${y}px,0px)`;
        })
    );

    provide(TOKEN,position.map(x=>x[0]));

    const dnd = task(function* (e: MouseEvent) {
        let [x, y] = position.value;
        let lastMv = e;
        // yield* testTask();
        const channel = readEvents({
            from: mousemove,
            until: merged([mouseup, mouseleave]),
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
            yield* nextAnimationFrame();
        }
    });

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
        easeInOutQuad: (t: number) =>
            t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
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
</script>

<main>
    <p>x: {$position[0]}, y: {$position[1]}</p>
    <div class="box">
        <div
            class="stick"
            bind:this={ref$$}
            on:mouseup={onmouseup}
            on:mousedown={dnd}
            on:mousemove={onmousemove}
            on:mouseleave={onmouseleave}
        />
        <div class="bg" />
    </div>
    <Child/>
</main>

<style>
    .stick {
        background: gray;
        border-radius: 50%;
        height: 100px;
        width: 100px;
        z-index: 111;
    }

    .box {
        display: block;
        transform: translate(100px, 100px);
    }

    .bg {
        display: block;
        position: absolute;
        z-index: -1111;
        border-radius: 50%;
        height: 200px;
        width: 200px;
        background: cyan;
        transform: translate(-50px, -150px);
    }
</style>
