class Reference<T = any> {
  get bind(): any {
    return (x: any) => {
      this._current = x;
    };
  }

  set bind(x: any) {
    this._current = x;
  }

  get current(): T | null {
    return this._current;
  }

  set current(value: T | null) {
    this._current = value;
  }

  constructor(private _current: T | null = null) {}
}

function reference<T>(initialValue?: T) {
  return new Reference(initialValue);
}

export { Reference, reference };
