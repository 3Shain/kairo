import { typescript } from 'svelte-preprocess';
import { Transformer } from 'svelte-preprocess/dist/types';

export declare const kairo: (args: Parameters<typeof typescript>[0]&{
    transformer: Transformer
}) => any;
