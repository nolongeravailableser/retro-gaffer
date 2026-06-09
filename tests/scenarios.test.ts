import { describe, it, expect } from 'vitest';
import {
  SCENARIOS,
  getScenario,
  buildScenarioSquad,
  runConfig,
} from '@/lib/scenarios';
import { getPlayer } from '@/data/pool';
import { getFormation } from '@/lib/formations';
import { CLASSIC } from '@/lib/modes';
import { XI_SIZE } from '@/lib/types';

describe('scenario squad builder', () => {
  it('fills every XI slot with a role-correct, in-band, unique player', () => {
    const { owned, xi } = buildScenarioSquad('442', { seed: 's', costMin: 2, costMax: 3 });
    const formation = getFormation('442');
    expect(xi.filter(Boolean)).toHaveLength(XI_SIZE);
    expect(new Set(owned).size).toBe(owned.length); // unique
    xi.forEach((id, slot) => {
      const p = getPlayer(id);
      expect(p).toBeTruthy();
      expect(p!.role).toBe(formation.slots[slot]);
      expect(p!.cost).toBeGreaterThanOrEqual(2);
      expect(p!.cost).toBeLessThanOrEqual(3);
    });
  });

  it('leaves the requested number of holes (and never the keeper)', () => {
    const { xi } = buildScenarioSquad('442', { seed: 's', costMin: 2, costMax: 3, holes: 1 });
    expect(xi.filter(Boolean)).toHaveLength(XI_SIZE - 1);
    expect(xi[0]).toBeTruthy(); // GK slot kept
  });

  it('is deterministic for a given seed', () => {
    const a = buildScenarioSquad('433', { seed: 'x', costMin: 2, costMax: 4 });
    const b = buildScenarioSquad('433', { seed: 'x', costMin: 2, costMax: 4 });
    expect(a.xi).toEqual(b.xi);
  });
});

describe('scenario definitions', () => {
  it('all have unique ids and valid configs', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENARIOS) {
      expect(s.config.startingLives).toBeGreaterThan(0);
      expect(s.startRound).toBeGreaterThanOrEqual(1);
      expect(s.startRound).toBeLessThanOrEqual(s.config.maxRounds);
      expect(getFormation(s.formation).id).toBe(s.formation);
    }
  });

  it('star rubrics return 1–3 across plausible outcomes', () => {
    for (const s of SCENARIOS) {
      for (const livesRemaining of [0, 1, 2, 3]) {
        for (const [a, b] of [[3, 0], [1, 0], [1, 1]]) {
          const stars = s.stars({
            livesRemaining,
            startingLives: s.config.startingLives,
            peakBankroll: 100,
            lastScoreA: a,
            lastScoreB: b,
          });
          expect(stars).toBeGreaterThanOrEqual(1);
          expect(stars).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});

describe('runConfig resolution', () => {
  it('prefers a scenario config, else falls back to mode + mutator', () => {
    const sc = SCENARIOS[0];
    expect(runConfig({ scenario: sc.id })).toBe(sc.config);
    expect(runConfig({ scenario: null, mode: 'classic', mutator: null })).toBe(CLASSIC);
    expect(runConfig({})).toBe(CLASSIC);
  });

  it('getScenario returns null for unknown/empty ids', () => {
    expect(getScenario(null)).toBeNull();
    expect(getScenario('nope')).toBeNull();
    expect(getScenario(SCENARIOS[0].id)).toBe(SCENARIOS[0]);
  });
});

describe('finalMustWin survival semantics', () => {
  it('Hold the Line allows survival without winning the final', () => {
    const hold = getScenario('hold_the_line')!;
    expect(hold.config.finalMustWin).toBe(false);
  });
  it('Smash & Grab requires winning the final', () => {
    const smash = getScenario('smash_and_grab')!;
    expect(smash.config.finalMustWin).toBe(true);
  });
});
