import {
  FLAG_ERROR,
  FLAG_UPTODATE,
  ATTR_EFFECT,
  ATTR_PURE,
  Node,
  Effect,
  WithOutgoingEdge,
  WithIncomingEdge,
  __dev_next_prio,
  ExpressionOf,
  evaluate,
  dirty,
  cleanup,
} from './reactivity';

describe('reactivity', () => {
  it('state-effect', () => {
    const f = __spec_create_state(0);
    const c = jest.fn();
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(f));

    f.expr = () => 1;
    dirty(f);

    expect(c).toBeCalled();

    evaluate(s, ($) => $(f));
    cleanup();
    dirty(f);
    expect(c).toBeCalledTimes(2);
  });

  it('state-expr-effect', () => {
    const f = __spec_create_state(0);
    const c = jest.fn();
    const p = __spec_create_expr(($) => $(f));
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(p));

    dirty(f);
    expect(c).toBeCalled();
  });

  it('switching-expr', () => {
    const f = __spec_create_state(0);
    const f_1 = __spec_create_expr(($) => $(f) + 1);
    const f_2 = __spec_create_expr(($) => $(f) + 2);
    const c = jest.fn();
    const p = __spec_create_expr(($) => ($(f) % 2 ? $(f_1) : $(f_2)));
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(p));
    cleanup();
    __spec_is_uptodate(f_2);
    expect(c).toBeCalledTimes(0);
    f.expr = () => 1;
    dirty(f);
    expect(c).toBeCalled();

    evaluate(s, ($) => $(p));
    cleanup();
    __spec_not_subscribed(f_2);
    __spec_with_exact_ordered_deps(p, [f, f_1]);
  });

  it('appending-expr', () => {
    const f = __spec_create_state(0);
    const f_1 = __spec_create_expr(($) => $(f) + 1);
    const f_2 = __spec_create_expr(($) => $(f) + 2);
    const c = jest.fn();
    const p = __spec_create_expr(($) => ($(f) % 2 ? ($(f_1), $(f_2)) : $(f_2)));
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(p));
    cleanup();
    __spec_is_uptodate(f_2);
    expect(c).toBeCalledTimes(0);
    f.expr = () => 1;
    dirty(f);
    expect(c).toBeCalled();

    evaluate(s, ($) => $(p));
    cleanup();
    // __spec_not_subscribed(f_2);
    __spec_with_exact_ordered_deps(p, [f, f_1, f_2]);
  });

  it('error-state-effect', () => {
    const f = __spec_create_state(0);
    const c = jest.fn();
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(f));

    f.expr = () => {
      throw 1;
    };
    dirty(f);

    expect(c).toBeCalled();

    try {
      evaluate(s, ($) => $(f));
    } catch (e) {
      expect(e).toBe(1);
    } finally {
      cleanup();
    }
    dirty(f);
    expect(c).toBeCalledTimes(2);
  });

  it('error-state-expr-effect', () => {
    const f = __spec_create_state(0);
    const c = jest.fn();
    const p = __spec_create_expr(($) => $(f));
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(p));

    f.expr = () => {
      throw 1;
    };
    dirty(f);

    expect(c).toBeCalled();
    // expect(f.flags & FLAG_UPTODATE).toBe(0);
    try {
      evaluate(s, ($) => $(p));
    } catch (e) {
      expect(e).toBe(1);
    } finally {
      cleanup();
    }
    __spec_with_exact_ordered_deps(s, [p]);
    __spec_with_exact_ordered_deps(p, [f]);
    dirty(f);
    expect(c).toBeCalledTimes(2);
  });

  it('duplicated deps', () => {
    const f = __spec_create_state(0);
    const f_1 = __spec_create_expr(($) => $(f) + 1);
    const f_2 = __spec_create_expr(($) => $(f) + 2);
    const c = jest.fn();
    const s = __spec_create_effect(c);
    evaluate(
      __spec_create_effect(() => {}),
      ($) => $(f_2)
    ); // make f_2 subscribed
    evaluate(s, ($) => ($(f), $(f_1), $(f), $(f_2)));
    cleanup();
    __spec_with_exact_ordered_deps(s, [f, f_1, f_2]);

    f.expr = () => 1;

    expect(c).toBeCalledTimes(0);
    dirty(f);
    expect(c).toBeCalled();

    evaluate(s, ($) => ($(f), $(f), $(f_2)));
    cleanup();
    __spec_with_exact_ordered_deps(s, [f, f_2]);
    // expect(c).toBeCalledTimes(2);

    evaluate(s, ($) => ($(f), $(f)));
    cleanup();
    __spec_with_exact_ordered_deps(s, [f]);
  });

  it('pure expr memoization', () => {
    const constant = __spec_create_state(0);
    const f = __spec_create_state(0);
    const f_1 = __spec_create_expr(($) => ($(f), 1));
    const f_2 = __spec_create_expr(($) => ($(constant),$(f_1) + 2));
    const c = jest.fn();
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(f_2));
    cleanup();
    __spec_with_exact_ordered_deps(s, [f_2]);

    f.expr = () => 1;
    dirty(f);
    evaluate(s, ($) => $(f_2));
    cleanup();
    __spec_with_exact_ordered_deps(s, [f_2]);
  });

  it('computation', () => {
    const constant = __spec_create_state(0);
    const f = __spec_create_state(0);
    const f_1 = __spec_create_expr(($) => ($(f), 1));
    const f_2 = __spec_create_expr(($) => ($(constant),$(f_1) + 2));
    const fc = __spec_create_computation($=>$(f_2));
    const c = jest.fn();
    const s = __spec_create_effect(c);
    evaluate(s, ($) => $(fc));
    cleanup();
    __spec_with_exact_ordered_deps(s, [fc]);

    f.expr = () => 1;
    dirty(f);
    evaluate(s, ($) => $(f_2));
    cleanup();
    __spec_with_exact_ordered_deps(s, [f_2]);
  });
});

function __spec_create_state<T>(value: T): Node<T> {
  return {
    attr: 0,
    flags: 0,
    expr: () => value,
    noe: null,
    last: null,
    vstk: [null!],
    state: null,
    is: Object.is,
    __dev_prio: __dev_next_prio(),
  };
}

function __spec_create_expr<T>(expr: ExpressionOf<T>): Node<T> {
  return {
    attr: ATTR_PURE,
    flags: 0,
    expr,
    noe: null,
    last: null,
    vstk: [null!],
    state: null,
    is: Object.is,
    __dev_prio: __dev_next_prio(),
  };
}

function __spec_create_computation<T>(expr: ExpressionOf<T>): Node<T> {
  return {
    attr: 0,
    flags: 0,
    expr,
    noe: null,
    last: null,
    vstk: [null!],
    state: null,
    is: Object.is,
    __dev_prio: __dev_next_prio(),
  };
}

function __spec_create_effect(onschedule: () => void): Effect {
  return {
    attr: ATTR_EFFECT,
    flags: 0,
    schedule: onschedule,
    __dev_prio: [Number.POSITIVE_INFINITY],
    noe: null,
  };
}

function __spec_not_subscribed(cell: WithIncomingEdge) {
  expect(cell.last).toBe(null);
}

function __spec_hasdeps(cell: WithOutgoingEdge) {
  expect(cell.noe).toBeTruthy();
}

function __spec_with_exact_ordered_deps(
  cell: WithOutgoingEdge,
  deps: WithIncomingEdge[]
) {
  let s = cell.noe;
  for (const d of deps) {
    expect(s!.to).toBe(d);
    s = s!.noe;
  }
  expect(s).toBeNull();
}

function __spec_with_exact_observers_list(
  cell: WithIncomingEdge,
  observers: WithOutgoingEdge[]
) {
  let x = cell.last;
  const s = new Set();
  while (x) {
    s.add(x.from);
    x = x.prev;
  }
  for (const o of observers) {
    s.delete(o);
  }
  expect(s.size).toBe(0);
}

function __spec_depsless(cell: WithOutgoingEdge) {
  expect(cell.noe).toBeNull();
}

function __spec_is_uptodate(cell: Node) {
  expect(cell.flags & FLAG_UPTODATE).toBe(FLAG_UPTODATE);
}

function __spec_is_dirty(cell: Node) {
  expect(cell.flags & FLAG_UPTODATE).toBe(0);
}

function __spec_is_error(cell: Node) {
  expect(cell.flags & FLAG_ERROR).toBe(FLAG_ERROR);
}
