import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import { debounceTime, map, take, tap } from 'rxjs/operators';

export async function benchrx(BASE, EXP) {


    function reducedComputedSSS(behs: Observable<number>[], size: number) {
        const ret = [] as Observable<number>[];
        for (let i = 0; i < behs.length; i += size) {
            ret.push(
                combineLatest(behs.slice(i * size, (i + 1) * size)).pipe(
                    debounceTime(0),
                    map(c => c.reduce((a, b) => a + b, 0)),
                    tap((x)=>{
                        console.log(x);
                    })
                )
            );
        }
        return ret;
    }

    function expSSS(base: number, exp: number) {
        const h = (new Array(Math.pow(base, exp))).fill(0).map(
            (v, i) => {
                return new BehaviorSubject(0);
            }
        )
        let h2: Observable<number>[] = h;
        for (let i = 0; i < exp; i++) {
            h2 = reducedComputedSSS(h2, base);
        }
        const ret = new BehaviorSubject(0);
        // h2[0].subscribe(ret);
        console.log(h2[0]);
        h2[0].subscribe({
            next:(s)=>console.log(s),
            error:(e)=>console.error(e),
            complete:()=>console.log('complete?')
        })
        return {
            last: () => ret,
            setters: h
        }
    }


    //#endregion

    const g = (() => {

        var cc = expSSS(BASE, EXP);

        return {
            run: (kk) => {
                for (let i = 0; i < cc.setters.length; i++) {
                    cc.setters[i].next(i * kk);
                }
            },
            num: () => {
                return cc.last().pipe(take(1)).toPromise();
            }
        }
    })()

    // for (let i = 0; i < 16; i++) {
    //     let start2 = performance.now();
    //     // @ts-ignore
    //     g.run(i);
    //     let end2 = performance.now();
    //     console.log(end2 - start2);
    //     // @ts-ignore
    //     // console.log(await g.num());
    // }
}