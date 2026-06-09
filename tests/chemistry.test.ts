import { describe, it, expect } from 'vitest';
import { computeChemistry, SYNERGY_BONUS } from '@/lib/chemistry';
import type { Player } from '@/lib/types';

function mk(id: string, tags: string[], attack = 50, defense = 50): Player {
  return {
    id,
    name: id,
    era: '2010',
    cost: 4,
    stats: { attack, defense },
    tags,
    role: 'MID',
    rarity: 'silver',
  };
}

describe('computeChemistry', () => {
  it('returns zeroes and no synergies for an empty XI', () => {
    const r = computeChemistry([]);
    expect(r.totalAttack).toBe(0);
    expect(r.totalDefense).toBe(0);
    expect(r.synergies).toEqual([]);
    expect(r.perPlayer).toEqual([]);
  });

  it('does not boost a lone player (no shared tag)', () => {
    const r = computeChemistry([mk('a', ['everton'], 80, 40)]);
    expect(r.synergies).toHaveLength(0);
    expect(r.perPlayer[0].multiplier).toBe(1);
    expect(r.totalAttack).toBe(80);
    expect(r.totalDefense).toBe(40);
  });

  it('lights up a synergy when two players share a tag (+10% each)', () => {
    const r = computeChemistry([
      mk('a', ['stoke'], 70, 50),
      mk('b', ['stoke'], 60, 40),
    ]);
    expect(r.synergies).toHaveLength(1);
    expect(r.synergies[0]).toMatchObject({ tag: 'stoke', count: 2 });
    expect(r.perPlayer[0].multiplier).toBeCloseTo(1.1);
    expect(r.perPlayer[1].multiplier).toBeCloseTo(1.1);
    expect(r.totalAttack).toBeCloseTo(70 * 1.1 + 60 * 1.1);
    expect(r.totalDefense).toBeCloseTo(50 * 1.1 + 40 * 1.1);
  });

  it('stacks additively: a player on two active tags gets +20%', () => {
    const r = computeChemistry([
      mk('a', ['stoke', 'cult_hero'], 50, 50),
      mk('b', ['stoke'], 50, 50),
      mk('c', ['cult_hero'], 50, 50),
    ]);
    const a = r.perPlayer.find((p) => p.player.id === 'a')!;
    expect(a.sharedTags.sort()).toEqual(['cult_hero', 'stoke']);
    expect(a.multiplier).toBeCloseTo(1 + 2 * SYNERGY_BONUS); // 1.2, not 1.21
    expect(a.attack).toBeCloseTo(60);
  });

  it('does not count a tag held by only one starter', () => {
    const r = computeChemistry([
      mk('a', ['everton', 'cult_hero']),
      mk('b', ['cult_hero']),
    ]);
    // cult_hero active (2), everton not (1)
    expect(r.synergies.map((s) => s.tag)).toEqual(['cult_hero']);
    expect(r.perPlayer[0].multiplier).toBeCloseTo(1.1);
  });

  it('is order-independent', () => {
    const players = [
      mk('a', ['stoke', 'cult_hero']),
      mk('b', ['stoke']),
      mk('c', ['cult_hero']),
    ];
    const forward = computeChemistry(players);
    const reversed = computeChemistry([...players].reverse());
    expect(reversed.totalAttack).toBeCloseTo(forward.totalAttack);
    expect(reversed.totalDefense).toBeCloseTo(forward.totalDefense);
    expect(reversed.synergies.map((s) => s.tag).sort()).toEqual(
      forward.synergies.map((s) => s.tag).sort()
    );
  });

  it('sorts synergies strongest-first then alphabetically', () => {
    const r = computeChemistry([
      mk('a', ['cult_hero', 'stoke']),
      mk('b', ['cult_hero', 'stoke']),
      mk('c', ['cult_hero']),
    ]);
    // cult_hero count 3, stoke count 2 -> cult_hero first
    expect(r.synergies.map((s) => s.tag)).toEqual(['cult_hero', 'stoke']);
  });
});
