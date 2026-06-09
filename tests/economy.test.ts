import { describe, it, expect } from 'vitest';
import {
  sellValue,
  checkBuy,
  checkRefresh,
  drawShop,
  ROSTER_CAP,
} from '@/lib/economy';
import { Rng } from '@/lib/rng';
import { POOL } from '@/data/pool';
import type { Player } from '@/lib/types';

function mk(id: string, cost: number): Player {
  return {
    id,
    name: id,
    era: '2010',
    cost,
    stats: { attack: 50, defense: 50 },
    tags: [],
    role: 'MID',
    rarity: 'silver',
  };
}

describe('sellValue', () => {
  it('returns rounded 80% of cost', () => {
    expect(sellValue(mk('a', 4))).toBe(3); // 3.2 → 3
    expect(sellValue(mk('b', 10))).toBe(8); // 8.0 → 8
    expect(sellValue(mk('c', 7))).toBe(6); // 5.6 → 6
    expect(sellValue(mk('d', 3))).toBe(2); // 2.4 → 2
  });
});

describe('checkBuy', () => {
  const p = mk('x', 5);
  it('allows a buy with funds and roster room', () => {
    expect(checkBuy(15, 0, p)).toEqual({ ok: true });
  });
  it('blocks when funds are short', () => {
    expect(checkBuy(4, 0, p).ok).toBe(false);
  });
  it('allows a buy when funds exactly equal cost', () => {
    expect(checkBuy(5, 0, p).ok).toBe(true);
  });
  it('blocks when the roster is full', () => {
    expect(checkBuy(99, ROSTER_CAP, p).ok).toBe(false);
  });
});

describe('checkRefresh', () => {
  it('allows refresh with >= £1M', () => {
    expect(checkRefresh(1).ok).toBe(true);
  });
  it('blocks refresh at £0M', () => {
    expect(checkRefresh(0).ok).toBe(false);
  });
});

describe('drawShop', () => {
  it('is deterministic for the same seed', () => {
    const a = drawShop(POOL, new Set(), new Rng(42));
    const b = drawShop(POOL, new Set(), new Rng(42));
    expect(a).toEqual(b);
  });

  it('returns the requested number of distinct players', () => {
    const shop = drawShop(POOL, new Set(), new Rng(7));
    expect(shop).toHaveLength(3);
    expect(new Set(shop).size).toBe(3);
  });

  it('never includes excluded (owned) ids', () => {
    const owned = new Set(POOL.slice(0, 5).map((p) => p.id));
    for (let seed = 0; seed < 50; seed++) {
      const shop = drawShop(POOL, owned, new Rng(seed));
      for (const id of shop) expect(owned.has(id)).toBe(false);
    }
  });

  it('returns fewer than size when the pool is nearly exhausted', () => {
    const owned = new Set(POOL.slice(0, POOL.length - 2).map((p) => p.id));
    const shop = drawShop(POOL, owned, new Rng(1));
    expect(shop).toHaveLength(2);
  });

  it('weights draws by rarity (equal pool → bronze beats icon)', () => {
    // Synthetic pool with the SAME count of each tier isolates the weighting.
    const rarities = ['bronze', 'silver', 'gold', 'icon'] as const;
    const pool: Player[] = [];
    for (const rarity of rarities) {
      for (let i = 0; i < 5; i++) {
        pool.push({
          id: `${rarity}_${i}`,
          name: `${rarity}_${i}`,
          cost: 3,
          stats: { attack: 50, defense: 50 },
          tags: [],
          role: 'MID',
          rarity,
        });
      }
    }
    const byId = new Map(pool.map((p) => [p.id, p]));
    const counts: Record<string, number> = { bronze: 0, silver: 0, gold: 0, icon: 0 };
    for (let seed = 0; seed < 800; seed++) {
      for (const id of drawShop(pool, new Set(), new Rng(seed))) {
        counts[byId.get(id)!.rarity]++;
      }
    }
    expect(counts.bronze).toBeGreaterThan(counts.silver);
    expect(counts.silver).toBeGreaterThan(counts.gold);
    expect(counts.gold).toBeGreaterThan(counts.icon);
  });
});
