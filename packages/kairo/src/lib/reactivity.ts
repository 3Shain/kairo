// #region - type definitions
interface Track {
  <T>(cell: Node<T>): T;
}

interface TrackContext {
  lastv: Node | null;
  node: ReadonlyNodeOrEffect;
  check: WithOutgoingEdge;
}

type ReadonlyNodeOrEffect = Readonly<Node | Effect>;

/**
 * explicit tracked expression
 */
export interface ExpressionOf<T> {
  (track: Track): T;
}

export interface WithOutgoingEdge {
  /** @internal next outgoing edge (source) */
  noe: OutgoingEdge | null;
}

export interface WithIncomingEdge {
  /** @internal last incoming edge (observer) */
  last: IncomingEdge | null;
}

export interface Node<T = unknown> extends WithOutgoingEdge, WithIncomingEdge {
  /** @internal */
  readonly attr: number;
  /** @internal */
  flags: number;
  /** @internal */
  state: any;
  /** @internal visitor stack */
  vstk: ReadonlyNodeOrEffect[];
  /** @internal */
  expr: ExpressionOf<T>;
  /** @internal */
  is: (a: any, b: any) => boolean;
  /** @internal */
  __dev_prio?: number[];
  /** @internal */
  __dev_name?: string;
}

export interface Effect extends WithOutgoingEdge {
  /** @internal */
  readonly attr: number;
  /** @internal */
  flags: number;
  /** @internal */
  schedule: () => void;
  /** @internal */
  __dev_prio: number[];
}

export interface OutgoingEdge extends WithOutgoingEdge {
  // nse: any[];
  to: Node;
  counter: IncomingEdge;
  w_error: typeof FLAG_ERROR | 0;
  w_state: any;
}

export interface IncomingEdge {
  from: ReadonlyNodeOrEffect;
  next: IncomingEdge | null;
  prev: IncomingEdge | null;
}

// #endregion

// #region - constants
export const ATTR_PURE = 0b0001;
export const ATTR_EFFECT = 0b0010;

export const FLAG_UPTODATE = 0b00000001;
export const ERASE_FLAG_UPTODATE = ~FLAG_UPTODATE;
export const FLAG_ERROR = 0b00010000;
export const ERASE_FLAG_ERROR = ~FLAG_ERROR;
// #endregion

// #region - registers
const regstack: TrackContext[] = [];
const disposed: OutgoingEdge[] = [];
// #endregion

// #region - implementations

function track<T>(dep: Node<T>): T {
  const reg = regstack[regstack.length - 1];
  __DEV__ && __dev_assert_prio(dep.__dev_prio!, reg.node.__dev_prio!);
  if (
    /** skip over visited deps */
    reg.lastv === null ||
    (reg.lastv !== dep && dep.vstk[dep.vstk.length - 1] !== reg.node)
  ) {
    if (reg.lastv) reg.lastv.vstk.push(reg.node);
    reg.lastv = dep;
    // #region - record outgoing edges
    if (
      reg.check.noe === null ||
      (reg.check.noe.to !== dep && disposed.push(reg.check.noe))
    ) {
      // unmatch 1.append 2.switch
      reg.check.noe = {
        noe: null,
        w_error: 0,
        w_state: null,
        to: dep,
        counter: iie(dep, reg.node),
      };
      // then (check.noe === null) will be guaranteed.
    }
    reg.check = reg.check.noe; // iterate
    // #endregion

    if ((dep.flags & FLAG_UPTODATE) === 0) {
      // if dep is visited, this is guaranteed to be true?
      try {
        dep.state = evaluate(dep, dep.expr!);
        dep.flags &= ERASE_FLAG_ERROR;
      } catch (e) {
        dep.flags |= FLAG_ERROR;
        dep.state = e;
      }
      (reg.check as OutgoingEdge).w_state = dep.state;
      // @ts-ignore
      (reg.check as OutgoingEdge).w_error = dep.flags & FLAG_ERROR;
    }
  }

  if (dep.flags & FLAG_ERROR) throw dep.state;
  return dep.state;
}

function iie(to: Node, from: ReadonlyNodeOrEffect) {
  return (to.last = to.last
    ? (to.last.next = {
        prev: to.last,
        next: null,
        from,
      })
    : {
        prev: null,
        next: null,
        from,
      });
}

export function evaluate<T>(node: Node<T> | Effect, expr: ExpressionOf<T>): T {
  // #region - memo optimazation
  if (node.noe !== null && node.attr & ATTR_PURE) {
    let edge = node.noe;
    for (;;) {
      if ((edge.to.flags & FLAG_UPTODATE) === 0) {
        try {
          edge.to.state = evaluate(edge.to, edge.to.expr);
          edge.to.flags &= ERASE_FLAG_ERROR;
        } catch (e) {
          edge.to.flags |= FLAG_ERROR;
          edge.to.state = e;
        }
      }
      if (
        (edge.w_error ^ edge.to.flags) & FLAG_ERROR ||
        !edge.to.is(edge.w_state, edge.to.state)
      ) {
        debugger;
        break;
      }
      if (edge.noe === null) {
        if (node.flags & FLAG_ERROR) throw (<Node>node).state;
        return (<Node<T>>node).state; // pass all memo check!
      }
      edge = edge.noe;
    }
  }
  // #endregion

  // #region - evaluation
  regstack.push({
    node,
    lastv: null,
    check: node,
  });
  __DEV__ && __dev_enter_nest();
  try {
    return expr(
      //
      __DEV__
        ? (cellOrCells) => {
            if (
              regstack.length &&
              regstack[regstack.length - 1].node !== node
            ) {
              throw new Error('Tracking outside of scope.');
            }
            return track(cellOrCells);
          }
        : /* istanbul ignore next */ track
    );
  } finally {
    __DEV__ && __dev_exit_nest();
    const reg = regstack.pop()!;
    if (reg.check.noe) {
      disposed.push(reg.check.noe);
      reg.check.noe = null;
    }
    node.flags |= FLAG_UPTODATE;

    // #region - clear visitor stack
    let edge = node.noe;
    while (edge && edge.noe) {
      edge.to.vstk.pop()!;
      edge = edge.noe;
    }
    // #endregion
  }

  // #endregion
}

export function cleanup(stack: OutgoingEdge[] = disposed) {
  while (stack.length) {
    let current = stack.pop()!;
    do {
      const { to, counter } = current;
      counter.next
        ? (counter.next.prev = counter.prev)
        : (to.last = counter.prev ? (counter.prev!.next = counter.next) : null);
      if (
        to.last === null &&
        to.noe /** if noe is null, it's already a 'constant' */
      ) {
        if (to.attr & ATTR_PURE) {
          stack.push(to.noe); // disposable
          to.noe = null;
          to.flags &= ERASE_FLAG_UPTODATE;
        }
      }
    } while ((current = current.noe!));
  }
}

export function dirty(cell: Node) {
  if (__dev_mutation_forbidden_ctx) {
    throw new Error('Mutation is forbidden');
  }
  cell.flags &= ERASE_FLAG_UPTODATE;
  const stack = [cell];
  // immediate evaluated cell
  const iec: Node[] = [];
  const effects: Effect[] = [];
  while (stack.length) {
    const c = stack.pop()!;
    if ((c.attr & (ATTR_PURE | ATTR_EFFECT)) === 0) {
      iec.push(c);
    }
    let last = c.last;
    while (last !== null) {
      const from = last.from;
      if (from.flags & FLAG_UPTODATE) {
        // @ts-expect-error - force written
        from.flags &= ERASE_FLAG_UPTODATE;
        if (from.attr & ATTR_EFFECT) {
          effects.push(from as Effect);
        } else {
          stack.push(from as Node);
        }
      }
      last = last.prev;
    }
  }
  for (const c of iec) {
    if (c.flags & FLAG_UPTODATE) continue;
    try {
      c.state = evaluate(c, c.expr);
      c.flags &= ERASE_FLAG_ERROR;
    } catch (e) {
      c.state = e;
      c.flags |= FLAG_ERROR;
    }
  }
  for (const i of effects) {
    i.schedule();
  }
}

/* istanbul ignore next */
export function __implicit_tracking<T>(
  cell: Node<T>,
  fallback: (cell: Node<T>) => T
) {
  if (regstack.length) return track(cell);
  return fallback(cell);
}
// #endregion

// #region - devmode check

let __dev_mutation_forbidden_ctx = false;
let __dev_current_prio = [0];

export function __dev_next_prio() {
  const ret = [...__dev_current_prio];
  __dev_current_prio[__dev_current_prio.length - 1]++;
  return ret;
}

function __dev_enter_nest() {
  __dev_current_prio = [...__dev_current_prio, 0];
}

function __dev_exit_nest() {
  __dev_current_prio = __dev_current_prio.slice(0, -1);
}

// assert a is smaller than b
function __dev_assert_prio(a: number[], b: number[]) {
  const m = Math.max(a.length, b.length);
  for (let i = 0; i < m; i++) {
    if (a[i] > b[i]) throw new Error(`AAA `); // [1] > [0]
    if (a[i] < b[i]) return; // [0,0] < [0,1]
    // otherwise, a[i] == b[i], i++
  }
  if (a.length < b.length) {
    return;
  }
  throw new Error(`Not `);
}

// #endregion
