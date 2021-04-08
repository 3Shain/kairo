export const nextTick =
   (function(){
       if(typeof process !== 'undefined'){
           return process.nextTick;
       }
       return queueMicrotask;
   })();
