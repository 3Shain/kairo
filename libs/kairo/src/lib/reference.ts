class Reference<T> {
  get current() {
    return this._current;
  }

  constructor(private _current?: T) {}

  [Symbol.toStringTag]: 'Reference';

  static create<T>(V?: T): [Reference<T>, any] {
    const ref = new Reference(V);
    const binder = (value: any) => {
      ref._current = value;
    };
    Object.defineProperties(binder, {
      bind: {
        get: () => binder,
        set: (value: any) => binder(value),
      },
    });
    (binder as any)[Symbol_bind_reference] = true;
    return [ref, binder];
  }
}

const Symbol_bind_reference: unique symbol = Symbol('binder');

function reference<T>(initial?: T) {
  return Reference.create(initial);
}

export { Reference, reference, Symbol_bind_reference };
