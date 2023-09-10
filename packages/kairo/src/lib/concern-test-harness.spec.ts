import { createConcern } from './concern';
import { createTestHarness } from './concern-test-harness';
const createMockConcernImpl = ()=>0;
const createMockAnotherConcernImpl = ()=>'foobar';

type ConcernType = number
type AnotherConcernType = string;

// a concern spefify an 'interface'
const ThisIsAConcern = createConcern<ConcernType>()('package-name:Concern');
const AnotherConcern = createConcern<AnotherConcernType>()('package-name:Concern2');


const TestC = createConcern<{}>()('test:Concern');

const ConcernImpl = ThisIsAConcern(function*(props:{sakeofp: string}){ return 1;});


const ThisIsAFakeConcern = createConcern<string>()('package-name:Concern');

const FakeConcernImpl = ThisIsAFakeConcern(function*(props:{sakeofp: string}){ return 'str';});


const Impl = TestC(function*(props: {
  app: number,
  kk: boolean
}) {
  const wtf = yield* ThisIsAConcern;

  return {
    text: '233'
  };
})

createTestHarness(function*() {
  // dependencies -> their implmentations are also written with generators (so could be tested the same way).
  const a_concern = yield* ThisIsAConcern;
  const another_concern = yield* AnotherConcern;

  // do some whatever business logic

  return {
    // exposed the model
  }
  // I think component could be one kind of Concern value (HoC)
  // like `return (props)=> <div>{...directly access kairo's `Cell` to get reactivity}</div>`
  // experimenting..
})
.withDependencyFactory(ThisIsAConcern, () => createMockConcernImpl())
.withDependencyFactory(AnotherConcern, () => createMockAnotherConcernImpl())
.shell((model, ctx)=>{
  // test with exposed model
  // `ctx` gives you the mocked object (so you can spy on)
});
