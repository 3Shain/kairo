export { withKairo } from './lib/with-kairo';
export * from './lib/application';
import { enableExternalSource } from 'solid-js';
import { Reaction } from 'kairo';

export function setupSolidIntegration() {
    enableExternalSource((fn,trigger)=>{
        const reaction = new Reaction(trigger);
        return {
            track: (x)=>{
                fn(x);
            },
            dispose: ()=>reaction.dispose()
        }
    })
}