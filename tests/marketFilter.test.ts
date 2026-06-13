import { describe, it, expect } from 'vitest';
import { filterAndSortMarket, type MarketQuery } from '@/lib/marketFilter';
import type { Player } from '@/lib/types';

/** Minimal player fixture — only the fields the filter/sort reads. */
function mk(id: string, name: string, atk: number, def: number, extra: Partial<Player> = {}): Player {
  return {
    id, name, cost: 3, stats: { attack: atk, defense: def }, tags: [],
    role: 'MID', rarity: 'gold', ...extra,
  } as Player;
}

// A tiny synthetic pool. isFreeAgent is overall(<64)-based (real lib), so a/b/d
// have both stats ≥66 (open market) and Charlie is well under 64 (free agent).
// Fees are injected (id → £M) so the sort/range tests own the math.
const POOL: Player[] = [
  mk('a', 'Alpha', 88, 82, { role: 'FWD', position: 'Striker' }),
  mk('b', 'Bravo', 72, 70, { role: 'MID', position: 'Playmaker' }),
  mk('c', 'Cheap Charlie', 40, 38, { role: 'DEF', position: 'CenterBack' }),
  mk('d', 'Delta', 68, 66, { role: 'DEF', position: 'Fullback' }),
];
const FEES: Record<string, number> = { a: 50, b: 20, c: 0, d: 8 };

function base(over: Partial<MarketQuery> = {}): MarketQuery {
  return {
    segment: 'open', role: 'ALL', position: 'ALL', query: '',
    minFee: null, maxFee: null, affordableOnly: false, bankroll: 1000,
    sortKey: 'overall', sortDesc: true,
    ownedSet: new Set(), isAtClub: () => false, feeOf: (p) => FEES[p.id] ?? 0,
    ...over,
  };
}

describe('filterAndSortMarket', () => {
  it('surfaces the WHOLE matching pool (no hidden tail / no cap)', () => {
    // 'open' excludes free agents (fee 0 = Charlie) → 3 remain, all returned.
    const r = filterAndSortMarket(POOL, base());
    expect(r).toHaveLength(3);
  });

  it('sorts by fee ascending — the bargains-first view', () => {
    const r = filterAndSortMarket(POOL, base({ sortKey: 'value', sortDesc: false }));
    expect(r.map((p) => p.id)).toEqual(['d', 'b', 'a']); // 8 < 20 < 50
  });

  it('sorts by overall descending by default', () => {
    const r = filterAndSortMarket(POOL, base());
    expect(r[0].id).toBe('a'); // highest rated
  });

  it('respects a fee range', () => {
    const r = filterAndSortMarket(POOL, base({ minFee: 5, maxFee: 25 }));
    expect(r.map((p) => p.id).sort()).toEqual(['b', 'd']); // 8 and 20 only
  });

  it('affordableOnly hides players over the bankroll', () => {
    const r = filterAndSortMarket(POOL, base({ affordableOnly: true, bankroll: 10 }));
    expect(r.map((p) => p.id)).toEqual(['d']); // only the £8M one (≤10)
  });

  it('filters by granular position', () => {
    const r = filterAndSortMarket(POOL, base({ position: 'Fullback' }));
    expect(r.map((p) => p.id)).toEqual(['d']);
  });

  it('free-agents segment returns only £0 unattached players', () => {
    const r = filterAndSortMarket(POOL, base({ segment: 'free' }));
    expect(r.map((p) => p.id)).toEqual(['c']);
  });

  it('rivals segment returns only at-club (poach) players', () => {
    const r = filterAndSortMarket(POOL, base({ segment: 'rivals', isAtClub: (id) => id === 'a' }));
    expect(r.map((p) => p.id)).toEqual(['a']);
  });

  it('excludes already-owned players', () => {
    const r = filterAndSortMarket(POOL, base({ ownedSet: new Set(['a']) }));
    expect(r.map((p) => p.id)).not.toContain('a');
  });

  it('name search is a case-insensitive substring', () => {
    const r = filterAndSortMarket(POOL, base({ query: 'charlie', segment: 'free' }));
    expect(r.map((p) => p.id)).toEqual(['c']);
  });
});
