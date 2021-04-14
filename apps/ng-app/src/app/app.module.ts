import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { KairoModule } from '@kairo/angular';
import { ChildComponent } from './child.component';
import { CommonModule } from '@angular/common';

@NgModule({
    declarations: [AppComponent, ChildComponent],
    imports: [
        BrowserModule,
        HttpClientModule,
        KairoModule.forRoot(() => {}),
        CommonModule,
    ],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {}
