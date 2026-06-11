import { describe, it, expect } from 'vitest';
import {
  wageDemand,
  evaluateBid,
  termsAffordable,
  maxWageOffer,
  WAGE_DEMAND_PREMIUM,
} from '@/lib/negotiation';
import { wage } from '@/lib/wages';
import { BOTTOM_TIER, TOP_TIER } from '@/lib/league';
import type { Player, Role } from '@/lib/types';

function mk(role: Role, attack: number, defense: number): Player {
  return { id: `${role}-${attack}-${defense}`, name: 'p', cost: 4, stats: { attack, defense }, tags: [], role, rarity: 'gold' };
}

describe('negotiation — personal terms', () => {
  const star = mk('FWD', 92, 60);

  it('wage demand sits above the bare wage and rises with the division', () => {
    const base = wage(star);
    const bottom = wageDemand(star, BOTTOM_TIER);
    const top = wageDemand(star, TOP_TIER);
    expect(bottom).toBeGreaterThanOrEqual(Math.round(base * WAGE_DEMAND_PREMIUM * 10) / 10);
    expect(top).toBeGreaterThan(bottom); // Premier League wages cost more
    expect(wageDemand(mk('DEF', 30, 30), BOTTOM_TIER)).toBeGreaterThanOrEqual(0.1); // floor
  });

  it('termsAffordable gates on the wage budget', () => {
    expect(termsAffordable(2, 3, 6)).toBe(true); // 3 + 2 ≤ 6
    expect(termsAffordable(4, 3, 6)).toBe(false); // 3 + 4 > 6
  });

  it('maxWageOffer rises with division and bankroll (the marquee gate)', () => {
    // A skint National League (bottom-tier) club can't match a galáctico's wage…
    const poorBottom = maxWageOffer(20, BOTTOM_TIER);
    const star = mk('FWD', 95, 60);
    expect(wageDemand(star, BOTTOM_TIER)).toBeGreaterThan(poorBottom); // refuses
    // …but the Premier League, or a rich club, can.
    expect(maxWageOffer(20, TOP_TIER)).toBeGreaterThan(poorBottom);
    expect(maxWageOffer(400, BOTTOM_TIER)).toBeGreaterThan(poorBottom);
    // A solid pro signs even when poor + low-division.
    expect(wageDemand(mk('MID', 72, 72), BOTTOM_TIER)).toBeLessThanOrEqual(maxWageOffer(35, BOTTOM_TIER));
  });
});

describe('negotiation — bidding', () => {
  it('accepts a bid at or above the asking price', () => {
    expect(evaluateBid(20, 20, 's').result).toBe('accept');
    expect(evaluateBid(20, 25, 's').result).toBe('accept');
  });

  it('free agents (asking 0) always accept', () => {
    expect(evaluateBid(0, 0, 's').result).toBe('accept');
  });

  it('counters a near-miss bid with a fee between bid and ask', () => {
    const v = evaluateBid(20, 18, 's');
    expect(v.result).toBe('counter');
    expect(v.counter!).toBeGreaterThan(18);
    expect(v.counter!).toBeLessThanOrEqual(20);
  });

  it('rejects a derisory lowball', () => {
    expect(evaluateBid(20, 5, 's').result).toBe('reject');
  });

  it('is deterministic for a given seed', () => {
    expect(evaluateBid(20, 17, 'seed-a')).toEqual(evaluateBid(20, 17, 'seed-a'));
  });
});
