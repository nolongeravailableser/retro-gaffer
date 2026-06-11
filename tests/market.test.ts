import { describe, it, expect } from 'vitest';
import { baseValue, marketValue, marketSellValue, marketTierMult, MARKET_SELL_RATE } from '@/lib/market';
import { TOP_TIER, BOTTOM_TIER } from '@/lib/league';
import type { Player, Role } from '@/lib/types';

function mk(role: Role, attack: number, defense: number): Player {
  return { id: `${role}-${attack}-${defense}`, name: 'p', cost: 4, stats: { attack, defense }, tags: [], role, rarity: 'gold' };
}

describe('market valuations', () => {
  it('baseValue is convex — stars cost disproportionately more than journeymen', () => {
    const low = baseValue(mk('MID', 50, 50));
    const mid = baseValue(mk('MID', 75, 75));
    const top = baseValue(mk('MID', 95, 95));
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(top);
    expect(top - mid).toBeGreaterThan(mid - low); // convex
    expect(low).toBeGreaterThanOrEqual(1);
  });

  it('division inflation: same player costs more the higher up the pyramid', () => {
    const star = mk('FWD', 92, 50);
    expect(marketTierMult(BOTTOM_TIER)).toBeCloseTo(1, 5);
    expect(marketValue(star, BOTTOM_TIER)).toBeLessThan(marketValue(star, TOP_TIER));
    // A star is genuinely expensive at the top (Premier League money).
    expect(marketValue(star, TOP_TIER)).toBeGreaterThan(marketValue(star, BOTTOM_TIER) * 2);
  });

  it('sell value is a haircut on market value', () => {
    const p = mk('DEF', 80, 88);
    expect(marketSellValue(p, 3)).toBeLessThan(marketValue(p, 3));
    expect(marketSellValue(p, 3)).toBeCloseTo(Math.round(marketValue(p, 3) * MARKET_SELL_RATE), 0);
  });
});
