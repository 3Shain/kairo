class Reference<T = any> {
  get bind(): any {
    return (x: any) => {
      this.current = x;
    };
  }

  set bind(x: any) {
    this.current = x;
  }

  constructor(public current: T | null = null) {}
}

interface ReadonlyReference<T> {
  readonly current: T;
}

function reference<T>(initialValue?: T) {
  return new Reference(initialValue);
}

export { Reference, ReadonlyReference, reference };
