import { Context } from 'kairo';
import { createContext } from 'solid-js';

export const KairoContext = createContext<Context>(Context.EMPTY);
