import { describe, it, expect } from 'vitest';
import {
  newFacilities,
  upgradeCost,
  isMaxed,
  matchdayIncome,
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
});
