class Reference<T> {
  get current() {
    return this._current;
  }

  constructor(private _current?: T) {}

  [Symbol.toStringTag]: 'Reference';

  static create<T>(initial?: T): [Reference<T>, SetReference] {
    const ref = new Reference(initial);
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
    return [ref, binder as SetReference];
  }
}

const Symbol_bind_reference: unique symbol = Symbol('binder');

interface SetReference {
  (value: any): void;
  bind: any;
  [Symbol_bind_reference]: true;
}

function reference<T>(initial?: T): [Reference<T>, SetReference] {
  return Reference.create(initial);
}

export { Reference, reference, SetReference, Symbol_bind_reference };
