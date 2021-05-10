import { Cleanable } from './types';

export class ObjectDisposedError extends Error {}

export const noop = () => {};

export function doCleanup(cleanup: Cleanable) {
    if (typeof cleanup === 'function') {
        cleanup();
    } else if (typeof cleanup === 'object') {
        if ('cancel' in cleanup) {
            cleanup.cancel();
        } else if ('unsubscribe' in cleanup) {
            cleanup.unsubscribe();
        } else if ('dispose' in cleanup) {
            cleanup.dispose();
        }
    }
}
