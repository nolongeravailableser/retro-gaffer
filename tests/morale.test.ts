import { describe, it, expect } from 'vitest';
import {
  morale,
  moraleBand,
  moraleMult,
  moraleModifiers,
  MORALE_NEUTRAL,
  MORALE_MAX_SWING,
} from '@/lib/morale';
import { SHARP_START } from '@/lib/training';

describe('morale (derived)', () => {
  it('rises with form and involvement', () => {
    const flying = morale(7.5, 100); // playing well, ever-present
    const benchedPoor = morale(5.2, 20); // out of form, frozen out
    expect(flying).toBeGreaterThan(benchedPoor);
    expect(moraleBand(flying)).toBe('buzzing');
    expect(moraleBand(benchedPoor)).toBe('unhappy');
  });

  it('a new signing (no apps, default sharpness) is around content', () => {
    const band = moraleBand(morale(null, SHARP_START));
    expect(['content', 'good']).toContain(band);
  });

  it('being frozen out (low sharpness) drags an otherwise fine player down', () => {
    expect(morale(6.5, 100)).toBeGreaterThan(morale(6.5, 15));
  });

  it('match nudge is bounded to ±3% and neutral at the midpoint', () => {
    expect(moraleMult(MORALE_NEUTRAL)).toBeCloseTo(1, 5);
    expect(moraleMult(100)).toBeCloseTo(1 + MORALE_MAX_SWING, 5);
    expect(moraleMult(0)).toBeGreaterThanOrEqual(1 - MORALE_MAX_SWING - 1e-9);
    expect(moraleMult(0)).toBeLessThan(1);
  });

  it('moraleModifiers maps each starter via the resolvers', () => {
    const mods = moraleModifiers(
      ['happy', 'sad'],
      (id) => (id === 'happy' ? 7.5 : 5.0),
      (id) => (id === 'happy' ? 100 : 20)
    );
    expect(mods.player.happy).toBeGreaterThan(1);
    expect(mods.player.sad).toBeLessThan(1);
  });
});
