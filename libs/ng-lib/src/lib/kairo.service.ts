import { Injectable } from '@angular/core';
import { Scope } from 'kairo';

export abstract class ScopeRef {
  public readonly scope: Scope;
}

@Injectable()
export class KairoScopeRefImpl {
  public scope: Scope;

  constructor() {}
}
