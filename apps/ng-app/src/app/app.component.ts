import { Component } from '@angular/core';
import { ngSetup, WithKairo } from '@kairo/angular';
import { } from 'kairo';

@Component({
  selector: 'realkairo-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
@WithKairo()
export class AppComponent extends ngSetup((props: any, useProp) => {
 
  return {
   
  };
}) {}