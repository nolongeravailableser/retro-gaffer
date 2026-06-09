import { describe, it, expect } from 'vitest';
import { Rng, hashSeed } from '@/lib/rng';

describe('Rng determinism', () => {
  it('produces identical sequences for the same numeric seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces identical sequences for the same string seed', () => {
    const a = new Rng('GAFFER-1-abc');
    const b = new Rng('GAFFER-1-abc');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next())
    );
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('emits floats in [0, 1)', () => {
    const r = new Rng('range-check');
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() stays within inclusive bounds', () => {
    const r = new Rng('int-check');
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('shuffle is deterministic and non-mutating', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = new Rng('shuffle').shuffle(input);
    const b = new Rng('shuffle').shuffle(input);
    expect(a).toEqual(b);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // untouched
    expect([...a].sort((x, y) => x - y)).toEqual(input); // same multiset
  });

  it('hashSeed is stable and non-zero', () => {
    expect(hashSeed('hello')).toBe(hashSeed('hello'));
    expect(hashSeed('hello')).not.toBe(hashSeed('world'));
    expect(hashSeed('')).toBeGreaterThan(0);
  });

  it('never locks on a zero seed', () => {
    const r = new Rng(0);
    expect(r.next()).toBeGreaterThan(0);
  });
});
