import { describe, it, expect } from 'vitest';
import {
  reviewBonus,
  careerHonours,
  PROMOTION_BONUS,
  SURVIVAL_BONUS,
  RELEGATION_BONUS,
  potentialStars,
  generateYouth,
  generateUnknowns,
  ageRoster,
  newMeta,
  youthMeta,
  resolveContracts,
  isExpiring,
  DEFAULT_CONTRACT,
  type SeasonRecord,
} from '@/lib/career';
import {
  getPlayer,
  registerPlayers,
  clearOverlay,
  POOL,
} from '@/data/pool';
import { overall } from '@/lib/wages';
import { FREE_AGENT_MAX_OVERALL } from '@/lib/market';
import type { Player, Role } from '@/lib/types';

describe('generateUnknowns — the grey starting squad', () => {
  const poolIds = new Set(POOL.map((p) => p.id));

  it('produces a fieldable, role-balanced squad with no real-pool collisions', () => {
    const squad = generateUnknowns('seedA');
    expect(squad).toHaveLength(15); // 2 GK, 5 DEF, 5 MID, 3 FWD — an XI + bench
    const count = (r: Role) => squad.filter((p) => p.role === r).length;
    // Enough of every role to field any of the formations' XIs.
    expect(count('GK')).toBeGreaterThanOrEqual(1);
    expect(count('DEF')).toBeGreaterThanOrEqual(4);
    expect(count('MID')).toBeGreaterThanOrEqual(4);
    expect(count('FWD')).toBeGreaterThanOrEqual(2);
    // Never collide with a real player id.
    for (const p of squad) {
      expect(p.id.startsWith('unknown-')).toBe(true);
      expect(poolIds.has(p.id)).toBe(false);
      expect(p.tags).toContain('unknown');
      expect(p.cost).toBe(0);
    }
  });

  it('rates every unknown BELOW the real free-agent floor (so real signings upgrade them)', () => {
    const squad = generateUnknowns('seedB');
    for (const p of squad) {
      expect(overall(p)).toBeLessThan(FREE_AGENT_MAX_OVERALL);
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateUnknowns('same')).toEqual(generateUnknowns('same'));
    expect(generateUnknowns('a')).not.toEqual(generateUnknowns('b'));
  });
});

describe('reviewBonus', () => {
  it('pays most for promotion, least for surviving relegation', () => {
    expect(reviewBonus('promoted')).toBe(PROMOTION_BONUS);
    expect(reviewBonus('champion')).toBe(PROMOTION_BONUS); // title = a promotion-tier reward
    expect(reviewBonus('stay')).toBe(SURVIVAL_BONUS);
    expect(reviewBonus('relegated')).toBe(RELEGATION_BONUS);
    expect(PROMOTION_BONUS).toBeGreaterThan(SURVIVAL_BONUS);
    expect(SURVIVAL_BONUS).toBeGreaterThan(RELEGATION_BONUS);
  });
});

describe('careerHonours', () => {
  const rec = (over: Partial<SeasonRecord>): SeasonRecord => ({
    season: 1, tier: 5, finishPos: 5, clubs: 12, outcome: 'stay', ...over,
  });

  it('tallies titles, promotions, relegations and the peak tier from history', () => {
    const history: SeasonRecord[] = [
      rec({ season: 1, tier: 5, finishPos: 1, outcome: 'promoted' }), // title + promotion
      rec({ season: 2, tier: 4, finishPos: 8, outcome: 'stay', cupWon: true }), // a cup run
      rec({ season: 3, tier: 4, finishPos: 11, outcome: 'relegated' }),
      rec({ season: 4, tier: 5, finishPos: 1, outcome: 'promoted' }), // another title + promotion
      rec({ season: 5, tier: 1, finishPos: 1, outcome: 'champion', cupWon: true }), // a double
    ];
    const h = careerHonours(history);
    expect(h.divisionTitles).toBe(3); // three 1st-place finishes
    expect(h.championOfEngland).toBe(true);
    expect(h.promotions).toBe(3); // 2 promoted + 1 champion
    expect(h.relegations).toBe(1);
    expect(h.seasonsPlayed).toBe(5);
    expect(h.highestTier).toBe(1);
    expect(h.cupTitles).toBe(2); // two domestic cups lifted
  });

  it('handles an empty history', () => {
    const h = careerHonours([]);
    expect(h.seasonsPlayed).toBe(0);
    expect(h.championOfEngland).toBe(false);
    expect(h.highestTier).toBe(Number.POSITIVE_INFINITY);
    expect(h.clubsManaged).toBe(0);
  });

  it('counts distinct clubs managed across the career', () => {
    const history: SeasonRecord[] = [
      rec({ season: 1, club: 'Crimson Casuals' }),
      rec({ season: 2, club: 'Crimson Casuals' }),
      rec({ season: 3, club: 'Oakvale City' }), // moved clubs after a sacking
      rec({ season: 4, club: 'Tarnby FC' }),
    ];
    expect(careerHonours(history).clubsManaged).toBe(3);
    // Legacy records with no club field still credit at least the one club.
    expect(careerHonours([rec({ season: 1 })]).clubsManaged).toBe(1);
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
    let meta: Record<string, ReturnType<typeof newMeta>> = { low: { age: 5, growthLeft: 0, contractYears: 3 } };
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

describe('contracts & Bosman', () => {
  it('newMeta/youthMeta carry a contract; isExpiring flags the final year', () => {
    expect(newMeta().contractYears).toBe(DEFAULT_CONTRACT);
    expect(youthMeta().contractYears).toBeGreaterThan(DEFAULT_CONTRACT);
    expect(isExpiring({ age: 0, growthLeft: 0, contractYears: 1 })).toBe(true);
    expect(isExpiring({ age: 0, growthLeft: 0, contractYears: 2 })).toBe(false);
    expect(isExpiring(undefined)).toBe(false); // missing → treated as a full deal
  });

  it('resolveContracts: renew resets, others count down, expiring+unrenewed leave', () => {
    const meta = {
      keep: { age: 1, growthLeft: 0, contractYears: 1 }, // expiring, will renew
      walk: { age: 3, growthLeft: 0, contractYears: 1 }, // expiring, not renewed → leaves
      stay: { age: 0, growthLeft: 0, contractYears: 3 }, // mid-deal, counts down
    };
    const { meta: next, departed } = resolveContracts(
      ['keep', 'walk', 'stay'],
      meta,
      new Set(['keep'])
    );
    expect(departed).toEqual(['walk']);
    expect(next.keep.contractYears).toBe(DEFAULT_CONTRACT); // renewed → reset
    expect(next.stay.contractYears).toBe(2); // counted down
    expect('walk' in next).toBe(false); // dropped from meta
  });
});
