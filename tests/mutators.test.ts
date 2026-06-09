import { describe, it, expect } from 'vitest';
import {
  MUTATORS,
  getMutator,
  applyMutator,
  resolveConfig,
  dailyMutator,
} from '@/lib/mutators';
import { CLASSIC, ENDLESS } from '@/lib/modes';
import { runScore } from '@/lib/score';

describe('mutators', () => {
  it('every mutator has a unique id and a pure-ish apply', () => {
    const ids = MUTATORS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MUTATORS) {
      const out = m.apply(CLASSIC);
      // Base config is not mutated in place.
      expect(CLASSIC.startingBankroll).toBe(50);
      expect(out).not.toBe(CLASSIC);
    }
  });

  it('applyMutator/resolveConfig are no-ops for null/unknown', () => {
    expect(applyMutator(CLASSIC, null)).toBe(CLASSIC);
    expect(applyMutator(CLASSIC, 'nope')).toBe(CLASSIC);
    expect(resolveConfig('classic', null)).toBe(CLASSIC);
    expect(resolveConfig(undefined, undefined)).toBe(CLASSIC);
  });

  it('specific mutators change the expected fields', () => {
    const glass = applyMutator(CLASSIC, 'glass_cannon');
    expect(glass.engine.xgScale).toBeCloseTo(CLASSIC.engine.xgScale * 1.6);

    const last = applyMutator(CLASSIC, 'last_stand');
    expect(last.startingLives).toBe(1);

    const under = applyMutator(CLASSIC, 'underdog');
    expect(under.startingBankroll).toBe(Math.round(CLASSIC.startingBankroll * 0.5));

    const steep = applyMutator(CLASSIC, 'steep_climb');
    expect(steep.roundTarget[0]).toBe(Math.round(CLASSIC.roundTarget[0] * 1.15));
  });

  it('mutators compose with any mode (Endless + Glass Cannon)', () => {
    const cfg = resolveConfig('endless', 'glass_cannon');
    expect(cfg.maxRounds).toBe(Infinity);
    expect(cfg.engine.xgScale).toBeCloseTo(ENDLESS.engine.xgScale * 1.6);
  });

  it('dailyMutator is deterministic and yields a real mutator id', () => {
    const a = dailyMutator('2026-06-09');
    const b = dailyMutator('2026-06-09');
    expect(a).toBe(b);
    expect(getMutator(a)).not.toBeNull();
  });
});

describe('endless mode', () => {
  it('has no finish line', () => {
    expect(ENDLESS.maxRounds).toBe(Infinity);
    expect(ENDLESS.scored).toBe(true);
  });
});

describe('runScore', () => {
  const baseRecord = { w: 3, d: 1, l: 1 };

  it('rewards reaching a deeper round', () => {
    const shallow = runScore({ round: 5, runStatus: 'lost', peakBankroll: 100, bestStreak: 2, record: baseRecord, maxRounds: Infinity });
    const deep = runScore({ round: 9, runStatus: 'lost', peakBankroll: 100, bestStreak: 2, record: baseRecord, maxRounds: Infinity });
    expect(deep).toBeGreaterThan(shallow);
  });

  it('a deeper run always beats a richer-but-shallower one', () => {
    const richShallow = runScore({ round: 5, runStatus: 'lost', peakBankroll: 9999, bestStreak: 6, record: baseRecord, maxRounds: Infinity });
    const poorDeep = runScore({ round: 6, runStatus: 'lost', peakBankroll: 0, bestStreak: 0, record: { w: 0, d: 0, l: 0 }, maxRounds: Infinity });
    expect(poorDeep).toBeGreaterThan(richShallow);
  });

  it('a completed win banks a bonus', () => {
    const won = runScore({ round: 12, runStatus: 'won', peakBankroll: 100, bestStreak: 5, record: baseRecord, maxRounds: 12 });
    const lostSameDepth = runScore({ round: 12, runStatus: 'lost', peakBankroll: 100, bestStreak: 5, record: baseRecord, maxRounds: 12 });
    expect(won).toBeGreaterThan(lostSameDepth);
  });
});
