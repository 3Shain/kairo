
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { kairoApp } from '@kairo/vue';

setTimeout(() => {
    createApp(App)
        .use(router)
        // .use(kairoApp(() => {})) // this line! remove it if you can not start vite! then add it back!
        .mount('#app');
}, 0);
// vite has a bug:
// any tsconfig paths can not resolve in the entry file immediately
// try modify the timeout interval and magics happen (wtf)