import { createApp } from 'vue';
import App from './App.vue';
import 'kairo'; // vite can't resolve indirect tsconfig path import..
import { setupVueIntegration } from '@kairo/vue';

setupVueIntegration();

createApp(App).mount('#app');