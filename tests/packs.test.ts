import { describe, it, expect } from 'vitest';
import { PACKS, getPack, decadeOf, seasonStartYear } from '@/lib/packs';
import { drawShop } from '@/lib/economy';
import { Rng } from '@/lib/rng';
import { POOL } from '@/data/pool';
import type { Player } from '@/lib/types';

describe('pack helpers', () => {
  it('parses the season start year', () => {
    expect(seasonStartYear('2003/04')).toBe(2003);
    expect(seasonStartYear('1993/94')).toBe(1993);
    expect(seasonStartYear(undefined)).toBeNull();
  });

  it('classifies decades', () => {
    const mk = (peak: string): Player => ({
      id: 'x', name: 'x', cost: 3, stats: { attack: 50, defense: 50 },
      tags: [], role: 'MID', rarity: 'silver', peak_season: peak,
    });
    expect(decadeOf(mk('1998/99'))).toBe('90s');
    expect(decadeOf(mk('2005/06'))).toBe('00s');
    expect(decadeOf(mk('2014/15'))).toBe('10s');
    expect(decadeOf(mk('2022/23'))).toBe('20s');
  });

  it('getPack falls back to All-Stars', () => {
    expect(getPack(undefined).id).toBe('all');
    expect(getPack('nonsense').id).toBe('all');
    expect(getPack('seriea').id).toBe('seriea');
  });
});

describe('pack filters select a non-empty, correct subset', () => {
  it('every non-"all" pack has players and matches its predicate', () => {
    for (const pack of PACKS) {
      const subset = POOL.filter(pack.filter);
      expect(subset.length).toBeGreaterThan(2); // enough to fill a shop
      for (const p of subset) expect(pack.filter(p)).toBe(true);
    }
  });

  it('league packs only contain that league', () => {
    expect(POOL.filter(getPack('epl').filter).every((p) => p.league === 'EPL')).toBe(true);
    expect(POOL.filter(getPack('laliga').filter).every((p) => p.league === 'LaLiga')).toBe(true);
  });
});

describe('Icon Pack guarantee', () => {
  const iconPack = getPack('icons');
  const pool = POOL.filter(iconPack.filter);

  it('only offers gold or icon cards', () => {
    for (const p of pool) expect(['gold', 'icon']).toContain(p.rarity);
  });

  it('always includes at least one icon across many seeds', () => {
    const byId = new Map(POOL.map((p) => [p.id, p]));
    for (let seed = 0; seed < 60; seed++) {
      const shop = drawShop(pool, new Set(), new Rng(seed), 3, 'icon');
      const hasIcon = shop.some((id) => byId.get(id)!.rarity === 'icon');
      expect(hasIcon).toBe(true);
    }
  });

  it('a guarantee with no eligible cards degrades gracefully (no throw)', () => {
    const bronzeOnly = POOL.filter((p) => p.rarity === 'bronze').slice(0, 5);
    expect(() => drawShop(bronzeOnly, new Set(), new Rng(1), 3, 'icon')).not.toThrow();
  });
});
