import { noop } from './utils';
import { EventStream, merged, stream } from './stream';

describe('stream', () => {
  it('should be lazy', () => {
    let EXE_COUNTER = 0;
    const _stream = new EventStream((next) => {
      EXE_COUNTER++;
      return () => {
        EXE_COUNTER--;
      };
    });
    expect(EXE_COUNTER).toBe(0);
    const unsub = _stream.listen(noop);
    expect(EXE_COUNTER).toBe(1);
    unsub();
    expect(EXE_COUNTER).toBe(0);
  });

  it('should share subscription', () => {
    let EXE_COUNTER = 0;
    const _stream = new EventStream((next) => {
      EXE_COUNTER++;
      return () => {
        EXE_COUNTER--;
      };
    });
    expect(EXE_COUNTER).toBe(0);
    const unsub = _stream.listen(noop);
    const unsub2 = _stream.listen(noop);
    const unsub3 = _stream.listen(noop);
    expect(EXE_COUNTER).toBe(1);
    unsub2();
    unsub();
    expect(EXE_COUNTER).toBe(1);
    unsub3();
    expect(EXE_COUNTER).toBe(0);
  });

  it('.transform() should work', () => {
    const [source, emitSource] = stream<number>();
    const transformed = source.transform((x) => x * 2);
    const unsub = transformed.listen((x) => {
      expect(x % 2).toBe(0);
    });
    emitSource(1);
    emitSource(3);
    emitSource(5);
    unsub();
  });

  it('.filter() should work', () => {
    const [source, emitSource] = stream<number>();
    const transformed = source.filter((x) => x % 2 === 0);
    const unsub = transformed.listen((x) => {
      expect(x % 2).toBe(0);
    });
    emitSource(1);
    emitSource(2);
    emitSource(3);
    emitSource(4);
    emitSource(5);
    unsub();
  });

  it('merged() should work', () => {
    const [source, emitSource] = stream<number>();
    const [source2, emitSource2] = stream<number>();
    const mergedSource = merged([source, source2]);
    let EXE_COUNTER = 0;
    const unsub = mergedSource.listen((x) => {
      EXE_COUNTER++;
    });
    emitSource(1);
    emitSource2(2);
    expect(EXE_COUNTER).toBe(2);
    unsub();
  });
});
