import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES,
  getDifficulty,
  canSack,
  DEFAULT_DIFFICULTY,
} from '@/lib/difficulty';

describe('difficulty matrix', () => {
  it('levers scale monotonically from easy → hardcore', () => {
    const { easy, standard, hardcore } = DIFFICULTIES;
    // Budget gets tighter as it gets harder.
    expect(easy.startBankrollMult).toBeGreaterThan(standard.startBankrollMult);
    expect(standard.startBankrollMult).toBeGreaterThan(hardcore.startBankrollMult);
    expect(easy.wageBudgetMult).toBeGreaterThan(hardcore.wageBudgetMult);
    // The board gets harsher (higher sack threshold = fires you sooner).
    expect(easy.sackThreshold).toBeLessThanOrEqual(standard.sackThreshold);
    expect(standard.sackThreshold).toBeLessThan(hardcore.sackThreshold);
    // The market gets more hostile.
    expect(hardcore.agentInflation).toBeGreaterThan(easy.agentInflation);
    expect(hardcore.rivalAggression).toBeGreaterThan(easy.rivalAggression);
  });

  it('standard reproduces today’s behaviour exactly (×1, relegation-only)', () => {
    const s = DIFFICULTIES.standard;
    expect(s.startBankrollMult).toBe(1.0);
    expect(s.wageBudgetMult).toBe(1.0);
    expect(s.agentInflation).toBe(1.0);
    expect(s.rivalAggression).toBe(1.0);
    expect(s.sackThreshold).toBe(0); // never fired on form
    expect(DEFAULT_DIFFICULTY).toBe('standard');
  });

  it('getDifficulty falls back to standard for unknown ids', () => {
    expect(getDifficulty('nonsense').id).toBe('standard');
    expect(getDifficulty(null).id).toBe('standard');
    expect(getDifficulty('hardcore').id).toBe('hardcore');
  });

  describe('canSack — board confidence teeth', () => {
    it('easy & standard never sack on confidence, even at rock bottom', () => {
      expect(canSack(DIFFICULTIES.easy, 0, 10)).toBe(false);
      expect(canSack(DIFFICULTIES.standard, 0, 10)).toBe(false);
    });

    it('hardcore respects the grace period, then bites below the threshold', () => {
      const hc = DIFFICULTIES.hardcore; // grace 1 season, threshold 35
      expect(canSack(hc, 10, 1)).toBe(false); // immune in the grace window
      expect(canSack(hc, 10, 2)).toBe(true); // past grace, dreadful form → sacked
      expect(canSack(hc, 34, 5)).toBe(true); // just under threshold
      expect(canSack(hc, 35, 5)).toBe(false); // at threshold → safe
      expect(canSack(hc, 80, 5)).toBe(false); // flying → safe
    });
  });
});
