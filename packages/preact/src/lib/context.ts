import { Context } from 'kairo';
import { createContext } from 'preact';

export const KairoContext = createContext<Context>(Context.EMPTY);
