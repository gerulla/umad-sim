export class RandomSource {
  constructor(seed = createRandomSeed()) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  random() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;

    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(max) {
    return Math.floor(this.random() * max);
  }

  bool(chance = 0.5) {
    return this.random() < chance;
  }

  choice(values) {
    return values[this.int(values.length)];
  }
}

export function createRandomSeed(previousSeed = 0, nonce = 0) {
  let seed = mix32(Date.now() ^ Math.floor(getNow() * 1000) ^ previousSeed ^ nonce);

  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(2);
    globalThis.crypto.getRandomValues(values);
    seed = mix32(seed ^ values[0] ^ values[1]);
  } else {
    seed = mix32(seed ^ Math.floor(Math.random() * 0xffffffff));
  }

  if (seed === previousSeed) {
    seed = mix32(seed + 0x9e3779b9 + nonce);
  }

  return seed >>> 0;
}

function getNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function mix32(value) {
  let next = value >>> 0;
  next ^= next >>> 16;
  next = Math.imul(next, 0x7feb352d);
  next ^= next >>> 15;
  next = Math.imul(next, 0x846ca68b);
  next ^= next >>> 16;
  return next >>> 0;
}
