import { describe, it, expect } from 'vitest';
import { featuredPlayerId, featuredCost, FEATURED_DISCOUNT } from '@/lib/featured';
import { getPlayer } from '@/data/pool';

describe('featured free agent', () => {
  it('is deterministic per date and a real marquee (gold/icon) player', () => {
    const id1 = featuredPlayerId('2026-06-10');
    const id2 = featuredPlayerId('2026-06-10');
    expect(id1).toBe(id2);
    const p = getPlayer(id1)!;
    expect(['gold', 'icon']).toContain(p.rarity);
  });

  it('rotates across dates', () => {
    const ids = new Set(
      ['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14'].map(featuredPlayerId)
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('discounts the cost (min £1M)', () => {
    expect(featuredCost(5)).toBe(Math.max(1, Math.round(5 * (1 - FEATURED_DISCOUNT))));
    expect(featuredCost(5)).toBeLessThan(5);
    expect(featuredCost(1)).toBeGreaterThanOrEqual(1);
  });
});
