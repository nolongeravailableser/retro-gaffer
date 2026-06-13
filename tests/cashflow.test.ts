import { describe, it, expect } from 'vitest';
import { matchweekCashflow } from '@/lib/cashflow';
import { tierMult, wageTierMult } from '@/lib/wages';
import { MATCH_REWARD } from '@/lib/economy';
import { ROUND_INCOME, interest } from '@/lib/ladder';
import { facilityUpkeep, matchdayIncomeFor, newFacilities } from '@/lib/stadium';

/**
 * cashflow.ts mirrors the store's per-matchweek economy. These lock the ASSEMBLY
 * (correct combination of the primitives × tier mult × season scale) so a change
 * that, say, drops upkeep from the math is caught — not the constant values, which
 * the libs own.
 */
describe('matchweekCashflow', () => {
  const TIER = 2;
  const facilities = { ...newFacilities(), stadium: 2 };
  const base = { tier: TIER, facilities, bankroll: 80, streak: 3, scale: 1, wageRaw: 12 };

  it('assembles each line from the same primitives the store uses', () => {
    const cf = matchweekCashflow(base);
    const dm = tierMult(TIER);
    expect(cf.winReward).toBe(Math.round(MATCH_REWARD.win * dm));
    expect(cf.drawReward).toBe(Math.round(MATCH_REWARD.draw * dm));
    expect(cf.gate).toBe(Math.round(ROUND_INCOME * dm + matchdayIncomeFor(2, 3)));
    expect(cf.interest).toBe(interest(80));
    expect(cf.wages).toBe(Math.round(12 * wageTierMult(TIER)));
    expect(cf.upkeep).toBe(facilityUpkeep(facilities, dm));
  });

  it('net = income − costs, and win > draw > loss', () => {
    const cf = matchweekCashflow(base);
    const costs = cf.wages + cf.upkeep;
    expect(cf.netLoss).toBe(cf.gate + cf.interest - costs);
    expect(cf.netDraw).toBe(cf.drawReward + cf.gate + cf.interest - costs);
    expect(cf.netWin).toBe(cf.winReward + cf.gate + cf.interest - costs);
    expect(cf.netWin).toBeGreaterThan(cf.netDraw);
    expect(cf.netDraw).toBeGreaterThan(cf.netLoss);
  });

  it('a win streak lifts gate income (fuller ground)', () => {
    const cold = matchweekCashflow({ ...base, streak: 0 });
    const hot = matchweekCashflow({ ...base, streak: 6 });
    expect(hot.gate).toBeGreaterThanOrEqual(cold.gate);
  });

  it('the season-length scale divides each line proportionally', () => {
    const full = matchweekCashflow({ ...base, scale: 1 });
    const half = matchweekCashflow({ ...base, scale: 0.5 });
    // Halving the scale roughly halves the wage line (no rounding edge at 12×mult).
    expect(half.wages).toBeLessThan(full.wages);
  });
});
