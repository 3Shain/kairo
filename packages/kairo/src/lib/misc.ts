/* istanbul ignore file: it's obviously simple. */

import { Cleanable } from './types';

export class ObjectDisposedError extends Error {}

export const noop = () => {};

export const identity = <T>(x: T) => x;

export function doCleanup(cleanup: Cleanable) {
  if (typeof cleanup === 'function') {
    cleanup();
  } else if (typeof cleanup === 'object') {
    if('abort' in cleanup){
      cleanup.abort();
    } else if ('cancel' in cleanup) {
      cleanup.cancel();
    } else if ('unsubscribe' in cleanup) {
      cleanup.unsubscribe();
    } else if ('dispose' in cleanup) {
      cleanup.dispose();
    }
  }
}

export function hostReportErrors(error: any) {
  setTimeout(()=>{
    throw error;
  });
}