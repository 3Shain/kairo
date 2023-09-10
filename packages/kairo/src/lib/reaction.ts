import {
  OutgoingEdge,
  evaluate,
  ExpressionOf,
  ATTR_EFFECT,
  cleanup,
} from './reactivity';
export class Reaction {
  /** @internal */
  noe: OutgoingEdge | null;
  /** @internal */
  readonly attr: number;
  /** @internal */
  flags: number;
  /** @internal */
  schedule: () => void;
  /** @internal */
  __dev_prio = [Number.POSITIVE_INFINITY];

  constructor(onSchedule: () => void) {
    this.noe = null;
    this.attr = ATTR_EFFECT;
    this.flags = 0;
    this.schedule = onSchedule;
  }

  track = <T>(program: ExpressionOf<T>): T => {
    try {
      return evaluate(this, program);
    } finally {
      cleanup();
    }
  };

  dispose = () => {
    if (this.noe) {
      cleanup([this.noe]);
      this.noe = null;
    }
  };
}
