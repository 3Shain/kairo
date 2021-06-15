const BITS_PER_BYTE = 32;
const MASK = BITS_PER_BYTE - 1; //

export class BloomFilter {
  public readonly buckets: Uint32Array;
  private m: number;

  constructor(
    public readonly size: number,
    public readonly numOfHash: number,
    inheritFrom?: Uint32Array
  ) {
    if (size <= 0) {
      throw Error('size should be positive');
    }
    // size should be the power of 2
    if (size & (size - 1)) {
      throw Error('size should be power of 2');
    }
    if (typeof Uint32Array !== undefined) {
      this.buckets = new Uint32Array(size);
    } else {
      this.buckets = new Array(size).fill(0) as any; // as if it is
    }
    this.m = this.size * BITS_PER_BYTE;
    if (inheritFrom) {
      for (let i = 0; i < size; i++) {
        this.buckets[i] = inheritFrom[i];
      }
    }
  }

  add(item: string) {
    const locations = this.locations(item);
    for (let i = 0; i < this.numOfHash; i++) {
      let num = locations[i];
      this.buckets[num >> 5] |= 1 << (num & MASK);
    }
  }

  test(item: string) {
    const locations = this.locations(item);
    for (let i = 0; i < this.numOfHash; i++) {
      let num = locations[i];
      if ((this.buckets[num >> 5] & (1 << (num & MASK))) === 0) {
        return false;
      }
    }
    return true;
  }

  locations(item: string): number[] {
    const a = fnv_1a(item);
    const b = fnv_1a(item, 1576284489); // The seed value is chosen randomly
    const m = this.m;
    let x = a & (m - 1);
    const r: number[] = [];
    for (let i = 0; i < this.numOfHash; i++) {
      r.push(x < 0 ? x + m : x);
      x = (x + b) & (m - 1);
    }
    return r;
  }
}

// Steal from https://github.com/jasondavies/bloomfilter.js/blob/master/bloomfilter.js

// Fowler/Noll/Vo hashing.
// Nonstandard variation: this function optionally takes a seed value that is incorporated
// into the offset basis. According to http://www.isthe.com/chongo/tech/comp/fnv/index.html
// "almost any offset_basis will serve so long as it is non-zero".
function fnv_1a(v: string, seed: number = 0) {
  var a = 2166136261 ^ seed;
  for (var i = 0, n = v.length; i < n; ++i) {
    var c = v.charCodeAt(i),
      d = c & 0xff00;
    if (d) a = fnv_multiply(a ^ (d >> 8));
    a = fnv_multiply(a ^ (c & 0xff));
  }
  return fnv_mix(a);
}

// a * 16777619 mod 2**32
function fnv_multiply(a: number) {
  return a + (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
}

// See https://web.archive.org/web/20131019013225/http://home.comcast.net/~bretm/hash/6.html
function fnv_mix(a: number) {
  a += a << 13;
  a ^= a >>> 7;
  a += a << 3;
  a ^= a >>> 17;
  a += a << 5;
  return a & 0xffffffff;
}
