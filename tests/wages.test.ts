import { describe, it, expect } from 'vitest';
import {
  overall,
  wage,
  wageBill,
  divisionMult,
  wageBudget,
  DIV_MULT_FLOOR,
  DIV_MULT_CEIL,
} from '@/lib/wages';
import type { Player, Role } from '@/lib/types';

function mk(role: Role, attack: number, defense: number): Player {
  return { id: `${role}-${attack}-${defense}`, name: 'p', cost: 4, stats: { attack, defense }, tags: [], role, rarity: 'gold' };
}

describe('wages', () => {
  it('overall is role-weighted', () => {
    // Same raw stats, a striker rates higher on attack-bias, a CB on defense-bias.
    const fw = overall(mk('FWD', 90, 40));
    const df = overall(mk('DEF', 90, 40));
    expect(fw).toBeGreaterThan(df); // FWD weights attack more
    expect(overall(mk('GK', 20, 90))).toBeGreaterThan(overall(mk('FWD', 20, 90)));
  });

  it('wage rises with rating and is convex (stars cost disproportionately)', () => {
    const low = wage(mk('MID', 55, 55));
    const mid = wage(mk('MID', 75, 75));
    const top = wage(mk('MID', 95, 95));
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(top);
    // Convex: the jump from mid→top exceeds low→mid.
    expect(top - mid).toBeGreaterThan(mid - low);
  });

  it('wageBill sums the squad', () => {
    const squad = [mk('FWD', 90, 40), mk('DEF', 40, 90), mk('GK', 20, 85)];
    const expected = Math.round((wage(squad[0]) + wage(squad[1]) + wage(squad[2])) * 10) / 10;
    expect(wageBill(squad)).toBeCloseTo(expected, 5);
  });

  it('divisionMult scales from floor (round 1) to ceil (final round)', () => {
    expect(divisionMult(1, 12)).toBeCloseTo(DIV_MULT_FLOOR, 5);
    expect(divisionMult(12, 12)).toBeCloseTo(DIV_MULT_CEIL, 5);
    expect(divisionMult(6, 12)).toBeGreaterThan(divisionMult(3, 12));
    // Endless (infinite maxRounds) stays bounded.
    expect(divisionMult(40, Infinity)).toBeGreaterThanOrEqual(DIV_MULT_FLOOR);
    expect(divisionMult(40, Infinity)).toBeLessThanOrEqual(DIV_MULT_CEIL);
  });

  it('wageBudget grows with bankroll and division', () => {
    expect(wageBudget(100, 1.5)).toBeGreaterThan(wageBudget(20, 1.5));
    expect(wageBudget(50, 1.6)).toBeGreaterThan(wageBudget(50, 0.6));
  });
});
