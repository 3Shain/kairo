import { Component } from '@angular/core';
import { ngSetup, WithKairo } from '@kairo/angular';
import { mut } from 'kairo';

@WithKairo()
@Component({
  selector: 'realkairo-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent extends ngSetup(() => {

  const [count,setCount] = mut(0);
  return {
   count,
   increment: ()=>setCount(x=>x+1)
  };
}) {}