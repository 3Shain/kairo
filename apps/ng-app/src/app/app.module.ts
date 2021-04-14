import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { KairoModule } from '@kairo/angular';
import { ChildComponent } from './child.component';

@NgModule({
    declarations: [AppComponent, ChildComponent],
    imports: [BrowserModule, HttpClientModule, KairoModule.forRoot(() => {})],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {}
