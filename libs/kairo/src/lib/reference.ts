const identity = <T>(x: T) => x;

class Reference<T = any> {
  get bind(): any {
    return (x: any) => {
      this._current = this._setter(x);
    };
  }

  set bind(x: any) {
    this._current = this._setter(x);
  }

  get current(): T | null {
    return this._current;
  }

  set current(value: T | null) {
    this._current = this._setter(value);
  }

  constructor(private _current: T | null = null, private _setter: Function) {}
}

class DerivedReference<T> implements ReadonlyReference<T>{
  constructor(private _getter:Function) {}

  get current(){
    return this._getter();
  }
}

interface ReadonlyReference<T> {
  readonly current: T;
}

function reference<T>(initialValue?: T, setter: (s: any) => T = identity) {
  return new Reference(initialValue, setter);
}

export { Reference, ReadonlyReference, reference };
