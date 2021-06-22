import { createApp } from 'vue';
import App from './App.vue';
import 'kairo'; // bug solved by import kairo first (you don't need to do so if install from npm)
// weird.
import { kairoApp } from '@kairo/vue';

createApp(App)
    .use(kairoApp(() => {}))
    .mount('#app');