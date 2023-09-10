import { AnyImplementation, buildImplSync, createConcern, Include } from './concern';

const T1 = createConcern<number>()('T1');
const T2 = createConcern<string>()('T2');
const T4 = createConcern<string>()('T4');

const IT1 = T1(function* () {
  const p = yield* T2;
  debugger;
  return Number.parseInt(p);
});

const IT14 = T1(function* () {
  const p = yield* T4;
  return Number.parseInt(p);
});

const IT1N = IT1.provide(
  T2(function* (props: { n: string }) {
    return props.n;
  })
);

const IT1S = T1(function* (C: { www: number }) {
  const [g, g2] = yield* Include(IT1, IT14);

  return g + g2;
})._provide(
  T2(function* (props: { www1: string }) {
    return props.www1;
  }).withPropsFactory((x: { www1: string }) => x),
  T4(function* (props: { x: string }) {
    return props.x;
  }).withPropsFactory((x: { x: string }) => x)
);

describe('concern', () => {
  it('test 1', () => {
    const ret = buildImplSync(IT1N.__factory__({ n: '18' }));
    expect(ret).toBe(18);
  });

  it('test 2', () => {
    expect(() => {
      buildImplSync(IT1.__factory__({ n: '18' }));
    }).toThrow('notfound');
  });

  it('test 3', () => {
    const ret = buildImplSync(
      IT1S.__factory__({ www1: '18', www: 13, x: '114514' })
    );
    expect(ret).toBe(36);
  });
});
