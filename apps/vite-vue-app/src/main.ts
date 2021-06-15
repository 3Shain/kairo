import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'kairo'; // bug solved by import kairo first (you don't need to do so if install from npm)
// weird.
import { kairoApp } from '@kairo/vue';

setTimeout(() => {
  createApp(App)
    .use(router)
    .use(kairoApp(() => {}))
    .mount('#app');
}, 0);
// vite has a bug:
// any tsconfig paths can not resolve in the entry file immediately
// try modify the timeout interval and magics happen (wtf)
