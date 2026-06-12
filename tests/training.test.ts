import { describe, it, expect } from 'vitest';
import {
  nextSharpness,
  sharpnessMult,
  nextFatigue,
  fatigueMult,
  conditionMult,
  focusModifiers,
  conditionModifiers,
  sharpnessBand,
  fatigueBand,
  SHARP_FULL,
  FAT_FREE,
  FAT_PER_MATCH,
} from '@/lib/training';

describe('training — sharpness', () => {
  it('rises starting, decays benched, and clamps to 0–100', () => {
    expect(nextSharpness(70, true)).toBeGreaterThan(70);
    expect(nextSharpness(70, false)).toBeLessThan(70);
    expect(nextSharpness(100, true)).toBe(100); // capped
    expect(nextSharpness(2, false)).toBe(0); // floored
  });

  it('penalty is gentle (≤5%) and zero when fully sharp', () => {
    expect(sharpnessMult(SHARP_FULL)).toBe(1);
    expect(sharpnessMult(100)).toBe(1);
    expect(sharpnessMult(0)).toBeGreaterThanOrEqual(0.95);
    expect(sharpnessMult(0)).toBeLessThan(1);
  });
});

describe('training — fatigue', () => {
  it('accrues starting, recovers resting, clamps', () => {
    expect(nextFatigue(0, true)).toBe(FAT_PER_MATCH);
    expect(nextFatigue(40, false)).toBeLessThan(40); // recovers
    expect(nextFatigue(100, true)).toBeLessThanOrEqual(100); // never exceeds the cap
    expect(nextFatigue(100, true)).toBeGreaterThan(80); // recover-then-load keeps it high
  });

  it('a regular starter settles near a mild equilibrium (≈72), barely penalised', () => {
    let f = 0;
    for (let i = 0; i < 40; i++) f = nextFatigue(f, true); // play every week
    expect(f).toBeGreaterThan(65);
    expect(f).toBeLessThan(78);
    expect(fatigueMult(f)).toBeGreaterThan(0.97); // gentle on a settled XI
  });

  it('fitness focus recovers faster than the default', () => {
    expect(nextFatigue(80, false, 'fitness')).toBeLessThan(nextFatigue(80, false, 'balanced'));
  });

  it('penalty is gentle (≤5%) and zero when fresh', () => {
    expect(fatigueMult(FAT_FREE)).toBe(1);
    expect(fatigueMult(0)).toBe(1);
    expect(fatigueMult(100)).toBeGreaterThanOrEqual(0.95);
    expect(fatigueMult(100)).toBeLessThan(1);
  });
});

describe('training — modifiers', () => {
  it('combined condition penalty stays bounded (~≥0.90)', () => {
    expect(conditionMult(70, 0)).toBe(1); // sharp + fresh
    expect(conditionMult(0, 100)).toBeGreaterThanOrEqual(0.9); // worst case still gentle
  });

  it('focus tilts the right roles, balanced/fitness are role-neutral', () => {
    expect(focusModifiers('attacking').role.FWD).toBeGreaterThan(1);
    expect(focusModifiers('defensive').role.DEF).toBeGreaterThan(1);
    expect(focusModifiers('balanced').role).toEqual({});
    expect(focusModifiers('fitness').role).toEqual({});
  });

  it('conditionModifiers maps each starter to their condition multiplier', () => {
    const mods = conditionModifiers(['a', 'b'], { a: 0, b: 70 }, { a: 0, b: 0 });
    expect(mods.player.a).toBeLessThan(1); // rusty
    expect(mods.player.b).toBe(1); // sharp + fresh
  });

  it('bands classify sensibly', () => {
    expect(sharpnessBand(90)).toBe('sharp');
    expect(sharpnessBand(20)).toBe('rusty');
    expect(fatigueBand(10)).toBe('fresh');
    expect(fatigueBand(95)).toBe('tired');
  });
});
