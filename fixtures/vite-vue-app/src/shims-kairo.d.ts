import type { Ref } from 'vue';
declare module 'kairo' {
  // I'm gonna tell a lie and hurt you (vue-language-service) 😭
  export interface Cell<T> extends Ref<T> {}
}
