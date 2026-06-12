import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES,
  getDifficulty,
  canSack,
  wageCap,
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
    // The competition stiffens: a softer division on Easy, a brutal one on Hardcore.
    expect(easy.aiStrengthMult).toBeLessThan(standard.aiStrengthMult);
    expect(standard.aiStrengthMult).toBeLessThan(hardcore.aiStrengthMult);
    // The market gets more hostile.
    expect(hardcore.agentInflation).toBeGreaterThan(easy.agentInflation);
    expect(hardcore.rivalAggression).toBeGreaterThan(easy.rivalAggression);
    // The job market after a sacking gets harsher: fewer offers, a bigger rep hit.
    expect(easy.jobOffers).toBeGreaterThan(standard.jobOffers);
    expect(standard.jobOffers).toBeGreaterThan(hardcore.jobOffers);
    expect(hardcore.repPenaltyOnSack).toBeGreaterThan(standard.repPenaltyOnSack);
    expect(easy.repPenaltyOnSack).toBe(0);
  });

  it('standard keeps a neutral economy/market + relegation-only board, but a contested pitch', () => {
    const s = DIFFICULTIES.standard;
    expect(s.startBankrollMult).toBe(1.0);
    expect(s.wageBudgetMult).toBe(1.0);
    expect(s.agentInflation).toBe(1.0);
    expect(s.rivalAggression).toBe(1.0);
    expect(s.sackThreshold).toBe(0); // never fired on form
    // The one non-neutral lever: the competition is tuned for a real contest.
    expect(s.aiStrengthMult).toBeGreaterThan(1.0);
    expect(DEFAULT_DIFFICULTY).toBe('standard');
  });

  it('getDifficulty falls back to standard for unknown ids', () => {
    expect(getDifficulty('nonsense').id).toBe('standard');
    expect(getDifficulty(null).id).toBe('standard');
    expect(getDifficulty('hardcore').id).toBe('hardcore');
  });

  it('the wage ceiling tightens as difficulty rises', () => {
    const budget = 30; // £30M/round soft budget
    expect(wageCap(budget, DIFFICULTIES.easy)).toBeGreaterThan(wageCap(budget, DIFFICULTIES.standard));
    expect(wageCap(budget, DIFFICULTIES.standard)).toBeGreaterThan(wageCap(budget, DIFFICULTIES.hardcore));
    expect(wageCap(budget, DIFFICULTIES.standard)).toBe(budget); // standard == the soft budget
  });

  describe('canSack — board confidence teeth', () => {
    it('easy & standard never sack on confidence, even at rock bottom', () => {
      expect(canSack(DIFFICULTIES.easy, 0, 10)).toBe(false);
      expect(canSack(DIFFICULTIES.standard, 0, 10)).toBe(false);
    });

    it('hardcore respects the grace period, then bites below the threshold', () => {
      const hc = DIFFICULTIES.hardcore; // grace 2 seasons, threshold 22
      expect(canSack(hc, 10, 2)).toBe(false); // immune in the grace window
      expect(canSack(hc, 10, 3)).toBe(true); // past grace, dreadful form → sacked
      expect(canSack(hc, 21, 5)).toBe(true); // just under threshold
      expect(canSack(hc, 22, 5)).toBe(false); // at threshold → safe
      expect(canSack(hc, 80, 5)).toBe(false); // flying → safe
    });
  });
});
