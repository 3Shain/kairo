import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { KairoModule } from '@kairo/angular';

@NgModule({
    declarations: [AppComponent],
    imports: [BrowserModule, HttpClientModule, KairoModule.forRoot(() => {})],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {}
