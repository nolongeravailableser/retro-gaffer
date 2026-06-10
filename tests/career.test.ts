import { describe, it, expect } from 'vitest';
import {
  boardTarget,
  boardWantsTitle,
  boardMet,
  potentialStars,
  generateYouth,
  ageRoster,
  newMeta,
  youthMeta,
} from '@/lib/career';
import {
  getPlayer,
  registerPlayers,
  clearOverlay,
} from '@/data/pool';
import type { Player } from '@/lib/types';

describe('boardTarget', () => {
  it('escalates and caps at the title (12)', () => {
    expect(boardTarget(1)).toBe(6);
    expect(boardTarget(2)).toBe(8);
    expect(boardTarget(3)).toBe(10);
    expect(boardTarget(4)).toBe(12);
    expect(boardTarget(9)).toBe(12);
  });
  it('never demands more than 12', () => {
    for (let s = 1; s <= 20; s++) expect(boardTarget(s)).toBeLessThanOrEqual(12);
  });
});

describe('board demands', () => {
  it('early seasons want a division; late seasons want the title', () => {
    expect(boardWantsTitle(1)).toBe(false);
    expect(boardWantsTitle(4)).toBe(true);
  });
  it('boardMet honours reach vs title', () => {
    // S1 (reach round 6): reaching 6 is enough, win or not.
    expect(boardMet(1, 6, false)).toBe(true);
    expect(boardMet(1, 5, false)).toBe(false);
    expect(boardMet(1, 5, true)).toBe(true); // a triumph always satisfies
    // S4 (title): only a triumph counts.
    expect(boardMet(4, 12, false)).toBe(false);
    expect(boardMet(4, 12, true)).toBe(true);
  });
});

describe('potentialStars', () => {
  it('maps ceilings to 1–5', () => {
    expect(potentialStars(45)).toBeGreaterThanOrEqual(1);
    expect(potentialStars(99)).toBe(5);
    expect(potentialStars(10)).toBe(1);
    expect(potentialStars(70)).toBeGreaterThan(potentialStars(55));
  });
});

describe('generateYouth', () => {
  it('is deterministic per seed', () => {
    expect(generateYouth('s-1', 2)).toEqual(generateYouth('s-1', 2));
  });
  it('produces free academy prospects with valid roles and stats', () => {
    const youth = generateYouth('seed', 3);
    expect(youth).toHaveLength(3);
    for (const y of youth) {
      expect(y.cost).toBe(0);
      expect(['GK', 'DEF', 'MID', 'FWD']).toContain(y.role);
      expect(y.stats.attack).toBeGreaterThanOrEqual(10);
      expect(y.stats.defense).toBeGreaterThanOrEqual(10);
      expect(y.tags).toContain('academy');
    }
  });
  it('gives distinct ids per slot', () => {
    const ids = generateYouth('x', 3).map((y) => y.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('ageRoster', () => {
  const base = (id: string, attack: number, defense: number): Player => ({
    id,
    name: id,
    cost: 3,
    stats: { attack, defense },
    tags: [],
    role: 'MID',
    rarity: 'silver',
  });

  it('youth ramp toward their potential while growthLeft remains', () => {
    clearOverlay();
    registerPlayers([{ ...base('y', 50, 40), potential: 65 }]);
    const { meta, roster } = ageRoster(['y'], { y: youthMeta() }, getPlayer);
    // gain = round((65 - 50) / 3) = 5 on the stronger side.
    expect(roster.y.stats.attack).toBe(55);
    expect(roster.y.stats.defense).toBe(43); // +round(5 * 0.6)
    expect(meta.y.growthLeft).toBe(2);
    expect(meta.y.age).toBe(0);
    clearOverlay();
  });

  it('veterans hold their level through the peak, then decline', () => {
    clearOverlay();
    registerPlayers([base('v', 80, 70)]);
    let meta: Record<string, ReturnType<typeof newMeta>> = { v: newMeta() };
    let stats = { attack: 80, defense: 70 };
    // Seasons 1–2: no decline (age <= PEAK_UNTIL = 2).
    for (let i = 0; i < 2; i++) {
      registerPlayers([{ ...base('v', stats.attack, stats.defense) }]);
      const r = ageRoster(['v'], meta, getPlayer);
      meta = r.meta;
      stats = r.roster.v.stats;
    }
    expect(stats.attack).toBe(80);
    // Season 3: now past the peak → decline.
    registerPlayers([{ ...base('v', stats.attack, stats.defense) }]);
    const r3 = ageRoster(['v'], meta, getPlayer);
    expect(r3.roster.v.stats.attack).toBeLessThan(80);
    clearOverlay();
  });

  it('clamps stats to the 10–99 range', () => {
    clearOverlay();
    registerPlayers([base('low', 12, 12)]);
    let meta: Record<string, ReturnType<typeof newMeta>> = { low: { age: 5, growthLeft: 0 } };
    let stats = { attack: 12, defense: 12 };
    for (let i = 0; i < 5; i++) {
      registerPlayers([{ ...base('low', stats.attack, stats.defense) }]);
      const r = ageRoster(['low'], meta, getPlayer);
      meta = r.meta;
      stats = r.roster.low.stats;
    }
    expect(stats.attack).toBeGreaterThanOrEqual(10);
    clearOverlay();
  });
});

describe('pool overlay', () => {
  it('overlay takes precedence and clears cleanly', () => {
    clearOverlay();
    const real = getPlayer('zidane'); // a base pool id (may exist)
    const fake: Player = {
      id: 'overlay-test',
      name: 'Overlay Kid',
      cost: 0,
      stats: { attack: 1, defense: 1 },
      tags: [],
      role: 'FWD',
      rarity: 'bronze',
    };
    registerPlayers([fake]);
    expect(getPlayer('overlay-test')?.name).toBe('Overlay Kid');
    clearOverlay();
    expect(getPlayer('overlay-test')).toBeUndefined();
    // Base pool lookups are unaffected by clearing the overlay.
    expect(getPlayer('zidane')).toEqual(real);
  });
});
