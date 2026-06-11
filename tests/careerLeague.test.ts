import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/useGameStore';
import { BOTTOM_TIER, division, totalWeeks } from '@/lib/league';
import type { MatchResult } from '@/lib/types';

/**
 * Integration coverage for the Career → league pyramid: drive whole seasons
 * through the store's resolve path and assert promotion / sacking / the
 * between-seasons review. Pure store wiring — no UI, no real match engine
 * (we feed synthetic results straight to resolveRound).
 */

function res(outcome: 'win' | 'loss', a: number, b: number): MatchResult {
  return { events: [], score: { a, b }, xg: { a, b }, outcome, suspensions: [], injuries: [] };
}

/** Play out the rest of the current season with a fixed per-week outcome. */
function playSeason(outcome: 'win' | 'loss') {
  const { resolveRound } = useGameStore.getState();
  const weeks = totalWeeks(useGameStore.getState().league!);
  for (let w = 0; w < weeks; w++) {
    // 11 player wins → 33 pts is unbeatable (every AI that could match it lost
    // to us); 11 losses → 0 pts is dead last.
    resolveRound(outcome === 'win' ? res('win', 3, 0) : res('loss', 0, 2));
  }
}

describe('career pyramid', () => {
  beforeEach(() => {
    useGameStore.getState().startCareer();
  });

  it('starts at the bottom of the pyramid with a generated league', () => {
    const s = useGameStore.getState();
    expect(s.career).not.toBeNull();
    expect(s.career!.tier).toBe(BOTTOM_TIER);
    expect(s.career!.season).toBe(1);
    expect(s.league).not.toBeNull();
    expect(s.league!.clubs).toHaveLength(12);
    expect(s.runStatus).toBe('playing');
  });

  it('winning the division opens a promotion review, then climbs a tier', () => {
    playSeason('win');
    const s = useGameStore.getState();
    // Season done → review (run still playing), promoted up the pyramid.
    expect(s.runStatus).toBe('playing');
    expect(s.careerReview).not.toBeNull();
    expect(s.careerReview!.outcome).toBe('promoted');
    expect(s.careerReview!.fromTier).toBe(BOTTOM_TIER);
    expect(s.careerReview!.toTier).toBe(BOTTOM_TIER - 1);
    expect(s.careerReview!.finishPos).toBe(1);

    // The finished season is logged to history before the review.
    expect(s.career!.history).toHaveLength(1);
    expect(s.career!.history[0]).toMatchObject({
      season: 1, tier: BOTTOM_TIER, finishPos: 1, outcome: 'promoted',
    });

    // Advance: a fresh league one tier up, season 2, history carried forward.
    useGameStore.getState().advanceCareerSeason(null);
    const next = useGameStore.getState();
    expect(next.careerReview).toBeNull();
    expect(next.career!.season).toBe(2);
    expect(next.career!.tier).toBe(BOTTOM_TIER - 1);
    expect(next.league!.matchweek).toBe(1);
    expect(next.career!.history).toHaveLength(1); // preserved across seasons
  });

  it('winning the top tier wins the whole run (champions of England)', () => {
    // Climb from the bottom to the summit: BOTTOM_TIER → TOP_TIER (=1).
    for (let tier = BOTTOM_TIER; tier > 1; tier--) {
      expect(useGameStore.getState().career!.tier).toBe(tier);
      playSeason('win');
      useGameStore.getState().advanceCareerSeason(null);
    }
    expect(useGameStore.getState().career!.tier).toBe(1); // Premier League
    // Win the Premier League → run over, won. No review (career complete).
    playSeason('win');
    const s = useGameStore.getState();
    expect(s.runStatus).toBe('won');
    expect(s.careerReview).toBeNull();
  });

  it('finishing in the bottom-tier drop zone ends the career (sacked)', () => {
    playSeason('loss');
    const s = useGameStore.getState();
    expect(s.runStatus).toBe('lost');
    expect(s.careerReview).toBeNull(); // no review — the run is over
    expect(s.career!.tier).toBe(BOTTOM_TIER);
  });

  it('upgrading a facility spends bankroll, bumps the level, and caps out', () => {
    useGameStore.setState({ bankroll: 500 }); // fund all three levels
    const before = useGameStore.getState().bankroll;
    useGameStore.getState().upgradeFacility('stadium');
    const after = useGameStore.getState();
    expect(after.career!.facilities.stadium).toBe(1);
    expect(after.bankroll).toBeLessThan(before);

    // Drive it to the cap, then a further upgrade is refused.
    useGameStore.getState().upgradeFacility('stadium');
    useGameStore.getState().upgradeFacility('stadium');
    expect(useGameStore.getState().career!.facilities.stadium).toBe(3);
    const atCap = useGameStore.getState().bankroll;
    useGameStore.getState().upgradeFacility('stadium');
    expect(useGameStore.getState().career!.facilities.stadium).toBe(3);
    expect(useGameStore.getState().bankroll).toBe(atCap); // no spend at max
  });

  it('the stadium adds flat matchday income each matchweek', () => {
    // Baseline income with no stadium.
    useGameStore.getState().resolveRound(res('win', 1, 0));
    const baseIncome = useGameStore.getState().lastIncome!.income;

    // A fresh career with a level-1 stadium earns more in the same fixture.
    useGameStore.getState().startCareer();
    useGameStore.getState().upgradeFacility('stadium');
    useGameStore.getState().resolveRound(res('win', 1, 0));
    const boosted = useGameStore.getState().lastIncome!.income;
    expect(boosted).toBe(baseIncome + 3); // matchdayIncome(1)
  });

  it('the medical centre shaves rounds off new injuries', () => {
    const injured: MatchResult = {
      ...res('win', 1, 0),
      injuries: [{ playerId: 'p1', rounds: 2 }],
    };
    // No medical: a 2-round knock lasts 2.
    useGameStore.getState().resolveRound(injured);
    expect(useGameStore.getState().injuries.p1).toBe(2);

    // Level-1 medical: the same knock is reduced to 1 round.
    useGameStore.getState().startCareer();
    useGameStore.getState().upgradeFacility('medical');
    useGameStore.getState().resolveRound(injured);
    expect(useGameStore.getState().injuries.p1).toBe(1);
  });

  it('prize money scales with the division (a higher tier pays more)', () => {
    // Win one matchweek in the bottom tier and note the reward.
    useGameStore.getState().resolveRound(res('win', 2, 0));
    const lowReward = useGameStore.getState().lastIncome!.reward;

    // Climb two tiers and win one matchweek there.
    playSeason('win');
    useGameStore.getState().advanceCareerSeason(null);
    playSeason('win');
    useGameStore.getState().advanceCareerSeason(null);
    const tier = useGameStore.getState().career!.tier;
    expect(tier).toBe(BOTTOM_TIER - 2);
    useGameStore.getState().resolveRound(res('win', 2, 0));
    const highReward = useGameStore.getState().lastIncome!.reward;
    expect(highReward).toBeGreaterThan(lowReward);
    expect(division(tier).name).toBe('League One');
  });
});
