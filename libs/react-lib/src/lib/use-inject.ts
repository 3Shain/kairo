import { } from 'kairo';
import { useContext, useRef } from 'react';
import { KairoContext } from './with-kairo';

export function useInject(token: any) {

    const value = useRef(null);
    const context = useContext(KairoContext);
    if (value.current === null) {
        // get value from token

        // analyze return value: unwrap buffers, 
    }
}