class Suspension {
  constructor(
    public readonly perform: (signal: AbortSignal) => Promise<void>
  ) {}
}

export { Suspension };
