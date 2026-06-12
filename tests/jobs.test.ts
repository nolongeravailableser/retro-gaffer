import { describe, it, expect } from 'vitest';
import {
  managerReputation,
  reputationCeilingTier,
  reputationLabel,
  generateVacancies,
  VACANCY_COUNT,
} from '@/lib/jobs';
import { BOTTOM_TIER, TOP_TIER } from '@/lib/league';
import { careerHonours } from '@/lib/career';
import type { SeasonRecord } from '@/lib/career';

const rec = (tier: number, finishPos: number, outcome: SeasonRecord['outcome']): SeasonRecord => ({
  season: 1, tier, finishPos, clubs: 12, outcome,
});

describe('manager reputation', () => {
  it('a fresh manager (no history) is unproven and bottom-tier only', () => {
    const rep = managerReputation(careerHonours([]));
    expect(rep).toBe(0);
    expect(reputationLabel(rep)).toBe('Unproven');
    expect(reputationCeilingTier(rep)).toBe(BOTTOM_TIER);
  });

  it('a Champion of England is elite and can be hired into the top flight', () => {
    const history: SeasonRecord[] = [
      rec(5, 1, 'promoted'), rec(4, 1, 'promoted'), rec(3, 1, 'promoted'),
      rec(2, 1, 'promoted'), rec(1, 1, 'champion'),
    ];
    const rep = managerReputation(careerHonours(history));
    expect(rep).toBeGreaterThanOrEqual(80);
    expect(reputationLabel(rep)).toBe('Elite');
    expect(reputationCeilingTier(rep)).toBe(TOP_TIER);
  });

  it('rises with achievement (more promotions → more reputation)', () => {
    const one = managerReputation(careerHonours([rec(5, 1, 'promoted')]));
    const three = managerReputation(
      careerHonours([rec(5, 1, 'promoted'), rec(4, 1, 'promoted'), rec(3, 1, 'promoted')])
    );
    expect(three).toBeGreaterThan(one);
  });

  it('ceiling tier rises monotonically with reputation', () => {
    let prev = BOTTOM_TIER + 1;
    for (let rep = 0; rep <= 100; rep += 10) {
      const t = reputationCeilingTier(rep);
      expect(t).toBeLessThanOrEqual(prev); // tier number falls (climbs) as rep grows
      prev = t;
    }
    expect(reputationCeilingTier(0)).toBe(BOTTOM_TIER);
    expect(reputationCeilingTier(100)).toBe(TOP_TIER);
  });
});

describe('job market — vacancies', () => {
  it('always offers at least one job (never game over)', () => {
    expect(generateVacancies(0, 'seed').length).toBeGreaterThanOrEqual(1);
    expect(generateVacancies(0, 'seed')).toHaveLength(VACANCY_COUNT);
  });

  it('only offers jobs from the reputation ceiling down to the base', () => {
    for (const rep of [0, 35, 70, 100]) {
      const ceiling = reputationCeilingTier(rep);
      for (const v of generateVacancies(rep, `s${rep}`, 8)) {
        expect(v.tier).toBeGreaterThanOrEqual(ceiling); // never above your ceiling
        expect(v.tier).toBeLessThanOrEqual(BOTTOM_TIER); // never below the base
      }
    }
  });

  it('a low-reputation manager is confined to the lower leagues', () => {
    // Unproven → ceiling is the bottom tier, so every offer is bottom-tier.
    for (const v of generateVacancies(0, 'low', 8)) {
      expect(v.tier).toBe(BOTTOM_TIER);
    }
  });

  it('is deterministic per seed with distinct club names', () => {
    expect(generateVacancies(50, 'same')).toEqual(generateVacancies(50, 'same'));
    const names = generateVacancies(50, 'names').map((v) => v.clubName);
    expect(new Set(names).size).toBe(names.length); // no duplicate clubs in one list
  });
});
