/**
 * Seeded pseudo-random number generator.
 *
 * THE most important invariant in the game: given the same seed, every
 * consumer (match engine, commentary picker, shop draw) produces the exact
 * same sequence. NEVER call Math.random() in game logic — route everything
 * through an Rng instance created here.
 */

/** Hash an arbitrary string into a 32-bit seed (xmur3). */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** A deterministic RNG with convenience helpers. */
export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    // Avoid a zero state, which would lock mulberry32.
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Next float in [0, 1) — mulberry32. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with the given probability p (0–1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one element. Throws on empty arrays. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Fisher–Yates shuffle into a NEW array (does not mutate input). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
