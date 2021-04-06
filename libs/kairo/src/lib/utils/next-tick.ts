export const nextTick =
   (function(){
       if('process' in globalThis){
           return process.nextTick;
       }
       return queueMicrotask;
   })();
