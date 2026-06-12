import { describe, it, expect } from 'vitest';
import {
  DIVISION_FINANCE,
  divisionFinance,
  prizeTierMult,
  wageTierMult,
  marketTierMult,
  seasonSponsorship,
  disciplinaryFine,
  LEAGUE_NEUTRAL_TIER,
  WAGE_TIER_K,
  MARKET_TIER_K,
} from '@/lib/finance';
import { BOTTOM_TIER, TOP_TIER, DIVISIONS } from '@/lib/league';

describe('finance — the division balancing array', () => {
  it('reproduces the legacy multipliers exactly (consolidation is behaviour-neutral)', () => {
    // Prize: bottom → floor 0.6, top → ceil 1.7, linear between.
    expect(prizeTierMult(BOTTOM_TIER)).toBe(0.6);
    expect(prizeTierMult(TOP_TIER)).toBe(1.7);
    expect(prizeTierMult(3)).toBe(1.15);
    // Wage / market: ×1 at the bottom, geometric up the pyramid.
    expect(wageTierMult(BOTTOM_TIER)).toBe(1);
    expect(wageTierMult(TOP_TIER)).toBeCloseTo(WAGE_TIER_K ** (BOTTOM_TIER - TOP_TIER), 10);
    expect(marketTierMult(BOTTOM_TIER)).toBe(1);
    expect(marketTierMult(TOP_TIER)).toBeCloseTo(MARKET_TIER_K ** (BOTTOM_TIER - TOP_TIER), 10);
  });

  it('covers every division and rises monotonically up the pyramid', () => {
    for (const d of DIVISIONS) expect(DIVISION_FINANCE[d.tier]).toBeDefined();
    // tier counts DOWN as you climb (5 → 1), so each step up should pay/cost more.
    for (let tier = BOTTOM_TIER; tier > TOP_TIER; tier--) {
      const lo = divisionFinance(tier);
      const hi = divisionFinance(tier - 1); // one rung up
      expect(hi.prizeMult).toBeGreaterThanOrEqual(lo.prizeMult);
      expect(hi.wageMult).toBeGreaterThan(lo.wageMult);
      expect(hi.marketMult).toBeGreaterThan(lo.marketMult);
      expect(hi.sponsorLocal).toBeGreaterThanOrEqual(lo.sponsorLocal);
      expect(hi.sponsorGlobal).toBeGreaterThanOrEqual(lo.sponsorGlobal);
    }
  });

  it('gates global/TV sponsorship to the top of the pyramid (reputation)', () => {
    // LOW bound: the bottom tier earns no global money — only a modest local deal.
    expect(divisionFinance(BOTTOM_TIER).sponsorGlobal).toBe(0);
    expect(divisionFinance(BOTTOM_TIER).sponsorLocal).toBeGreaterThan(0);
    // HIGH bound: the top flight's global deal dwarfs its local one.
    expect(divisionFinance(TOP_TIER).sponsorGlobal).toBeGreaterThan(
      divisionFinance(TOP_TIER).sponsorLocal
    );
    expect(seasonSponsorship(TOP_TIER)).toBeGreaterThan(seasonSponsorship(BOTTOM_TIER));
  });

  it('falls back to the neutral mid tier for an unknown division', () => {
    expect(divisionFinance(999)).toEqual(divisionFinance(LEAGUE_NEUTRAL_TIER));
    expect(divisionFinance(0)).toEqual(divisionFinance(LEAGUE_NEUTRAL_TIER));
  });

  it('fines: a red counts double, scale with the division, and bottom out at zero', () => {
    expect(disciplinaryFine(0, 0, TOP_TIER)).toBe(0); // LOW bound: no cards, no fine
    expect(disciplinaryFine(0, 1, TOP_TIER)).toBe(disciplinaryFine(2, 0, TOP_TIER)); // red = 2 yellows
    // HIGH bound: the same misconduct costs more in a richer division.
    expect(disciplinaryFine(3, 1, TOP_TIER)).toBeGreaterThan(disciplinaryFine(3, 1, BOTTOM_TIER));
    expect(disciplinaryFine(-5, -5, TOP_TIER)).toBe(0); // clamped, never negative
  });
});
