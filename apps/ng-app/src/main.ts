import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

declare global {
  const __DEV__: boolean;
  const __TEST__: boolean;
}

(window as any).__DEV__ = true;
(window as any).__TEST__ = true;

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
