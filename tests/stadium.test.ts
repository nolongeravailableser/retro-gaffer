import { describe, it, expect } from 'vitest';
import {
  newFacilities,
  upgradeCost,
  isMaxed,
  matchdayIncome,
  matchdayIncomeFor,
  attendance,
  attendanceFill,
  stadiumCapacity,
  youthBonus,
  injuryReduction,
  MAX_LEVEL,
  FACILITY_IDS,
  FACILITIES,
} from '@/lib/stadium';

describe('stadium facilities', () => {
  it('start at zero across all facilities', () => {
    const f = newFacilities();
    for (const id of FACILITY_IDS) expect(f[id]).toBe(0);
  });

  it('upgrade cost rises with each level', () => {
    for (const id of FACILITY_IDS) {
      expect(upgradeCost(id, 0)).toBe(FACILITIES[id].step);
      expect(upgradeCost(id, 1)).toBeGreaterThan(upgradeCost(id, 0));
      expect(upgradeCost(id, 2)).toBeGreaterThan(upgradeCost(id, 1));
    }
  });

  it('isMaxed only at the cap', () => {
    expect(isMaxed(MAX_LEVEL - 1)).toBe(false);
    expect(isMaxed(MAX_LEVEL)).toBe(true);
  });

  it('effects scale with level and are zero at level 0', () => {
    expect(matchdayIncome(0)).toBe(0);
    expect(matchdayIncome(3)).toBeGreaterThan(matchdayIncome(1));
    expect(youthBonus(0)).toBe(0);
    expect(youthBonus(2)).toBe(2);
    expect(injuryReduction(0)).toBe(0);
    expect(injuryReduction(3)).toBe(3);
  });

  it('fans/attendance: bigger ground + better form → fuller house', () => {
    expect(stadiumCapacity(3)).toBeGreaterThan(stadiumCapacity(0));
    // Fill rises with form and is bounded 0.6–1.0.
    expect(attendanceFill(0)).toBeLessThan(attendanceFill(5));
    expect(attendanceFill(99)).toBeLessThanOrEqual(1);
    expect(attendanceFill(-5)).toBeGreaterThanOrEqual(0.6);
    // Attendance scales with both capacity and fill.
    expect(attendance(3, 5)).toBeGreaterThan(attendance(3, 0));
    expect(attendance(3, 5)).toBeGreaterThan(attendance(1, 5));
  });

  it('matchday income flexes with the crowd; a neutral run ≈ the flat base', () => {
    // At a neutral run (streak 1 = reference fill) it matches the flat figure.
    expect(matchdayIncomeFor(2, 1)).toBe(matchdayIncome(2));
    // A packed house pays more, an empty one less.
    expect(matchdayIncomeFor(2, 5)).toBeGreaterThan(matchdayIncomeFor(2, 1));
    expect(matchdayIncomeFor(2, 0)).toBeLessThanOrEqual(matchdayIncomeFor(2, 1));
    // Level 0 (no ground) still earns nothing.
    expect(matchdayIncomeFor(0, 5)).toBe(0);
  });
});
