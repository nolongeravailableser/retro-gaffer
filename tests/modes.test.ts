import { describe, it, expect } from 'vitest';
import { CLASSIC, getMode, MODES, DEFAULT_MODE_ID } from '@/lib/modes';
import {
  MAX_ROUNDS,
  STARTING_LIVES,
  ROUND_INCOME,
  ROUND_TARGET,
  roundTargetStrength,
  buildRoundOpponent,
} from '@/lib/ladder';
import { STARTING_BANKROLL } from '@/lib/economy';
import { simulateMatch, type MatchTeam } from '@/lib/engine';
import { drawEvent } from '@/lib/events';
import { BOSSES } from '@/lib/bosses';

describe('mode registry', () => {
  it('CLASSIC mirrors the shipped constants (single source of truth)', () => {
    expect(CLASSIC.maxRounds).toBe(MAX_ROUNDS);
    expect(CLASSIC.startingLives).toBe(STARTING_LIVES);
    expect(CLASSIC.startingBankroll).toBe(STARTING_BANKROLL);
    expect(CLASSIC.roundIncome).toBe(ROUND_INCOME);
    expect(CLASSIC.roundTarget).toBe(ROUND_TARGET);
    expect(CLASSIC.bosses).toBe(BOSSES);
  });

  it('getMode resolves classic and falls back for unknown ids', () => {
    expect(getMode('classic')).toBe(CLASSIC);
    expect(getMode(undefined)).toBe(CLASSIC);
    expect(getMode(null)).toBe(CLASSIC);
    expect(getMode('does-not-exist')).toBe(CLASSIC);
    expect(MODES[DEFAULT_MODE_ID]).toBe(CLASSIC);
  });
});

describe('Classic config is byte-identical to the engine defaults', () => {
  const a: MatchTeam = { name: 'A', attack: 700, defense: 650, squad: [] };
  const b: MatchTeam = { name: 'B', attack: 680, defense: 640, squad: [] };

  it('simulateMatch with CLASSIC.engine equals the no-arg default', () => {
    for (const seed of ['s1', 's2', 's3']) {
      expect(simulateMatch(a, b, seed, CLASSIC.engine)).toEqual(
        simulateMatch(a, b, seed)
      );
    }
  });

  it('buildRoundOpponent with CLASSIC shape equals the no-arg default', () => {
    for (let round = 1; round <= 12; round++) {
      const withShape = buildRoundOpponent(700, 650, round, 'run-1', {
        roundTarget: CLASSIC.roundTarget,
        bosses: CLASSIC.bosses,
      });
      const plain = buildRoundOpponent(700, 650, round, 'run-1');
      expect(withShape).toEqual(plain);
    }
  });

  it('drawEvent with CLASSIC.eventRates equals the no-arg default', () => {
    for (let round = 1; round <= 12; round++) {
      expect(drawEvent(round, 'run-1', ['mf', 'st'], [], CLASSIC.eventRates)).toEqual(
        drawEvent(round, 'run-1', ['mf', 'st'], [])
      );
    }
  });

  it('roundTargetStrength with CLASSIC.roundTarget equals the no-arg default', () => {
    for (let round = 1; round <= 16; round++) {
      expect(roundTargetStrength(round, CLASSIC.roundTarget)).toBe(
        roundTargetStrength(round)
      );
    }
  });
});
