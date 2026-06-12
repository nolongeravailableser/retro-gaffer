import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/useGameStore';
import { BOTTOM_TIER, division, totalWeeks } from '@/lib/league';
import { overall } from '@/lib/wages';
import { POOL } from '@/data/pool';
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
    // The stadium adds matchday income (now folded into the season-length-scaled
    // round income, so the boost is proportional rather than a flat +3).
    expect(boosted).toBeGreaterThan(baseIncome);
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

  it('signings are gated to the transfer window', () => {
    // A free agent (overall < 64) costs nothing — a clean signing to test the gate.
    const freeAgent = POOL.find((p) => overall(p) < 64)!;
    // Matchweek 1 (summer window open): the signing goes through.
    expect(useGameStore.getState().league!.matchweek).toBe(1);
    useGameStore.getState().signPlayer(freeAgent.id);
    expect(useGameStore.getState().owned).toContain(freeAgent.id);

    // Jump to a closed week — a new signing is blocked with an error notice.
    const league = useGameStore.getState().league!;
    useGameStore.setState({ league: { ...league, matchweek: 4 } });
    const other = POOL.find((p) => overall(p) < 64 && p.id !== freeAgent.id)!;
    const before = useGameStore.getState().owned.length;
    useGameStore.getState().signPlayer(other.id);
    expect(useGameStore.getState().owned.length).toBe(before); // no-op
    expect(useGameStore.getState().noticeKind).toBe('error');
    expect(useGameStore.getState().notice).toMatch(/window closed/i);
  });

  it('contracts: a signing gets a deal, then expires to a free unless renewed', () => {
    // Sign two free agents at MW1 (window open) → each on a 3-year deal.
    const frees = POOL.filter((p) => overall(p) < 64).slice(0, 2);
    const [stay, walk] = frees;
    useGameStore.getState().signPlayer(stay.id);
    useGameStore.getState().signPlayer(walk.id);
    expect(useGameStore.getState().career!.meta[stay.id].contractYears).toBe(3);

    // Drive the deal down to its final year (two season rollovers).
    const renewSeason = () => {
      playSeason('win'); // win the division → promotion review
      useGameStore.getState().advanceCareerSeason(null); // no renewals
    };
    renewSeason(); // 3 → 2
    renewSeason(); // 2 → 1 (now expiring)
    expect(useGameStore.getState().career!.meta[stay.id].contractYears).toBe(1);

    // In the next review, renew `stay` but not `walk`, then advance.
    playSeason('win');
    expect(useGameStore.getState().careerReview).not.toBeNull();
    useGameStore.getState().renewContract(stay.id);
    expect(useGameStore.getState().careerReview!.renewed).toContain(stay.id);
    useGameStore.getState().advanceCareerSeason(null);

    const s = useGameStore.getState();
    expect(s.owned).toContain(stay.id); // renewed → kept, fresh deal
    expect(s.career!.meta[stay.id].contractYears).toBe(3);
    expect(s.owned).not.toContain(walk.id); // expired + unrenewed → left on a free
    expect(s.inbox.some((m) => m.kind === 'transfer')).toBe(true); // Bosman note
  });

  it('a poached rival re-signs a replacement (the market stays alive)', () => {
    // Start a standalone league (AI clubs own real squads).
    useGameStore.getState().startLeague();
    const league = useGameStore.getState().league!;
    const rival = league.clubs.find((c) => c.id !== 'YOU' && (c.squad?.length ?? 0) > 0)!;
    const target = rival.squad![0];
    const beforeSquad = rival.squad!.length;
    // Give plenty of bankroll so the poach completes, and poach.
    useGameStore.setState({ bankroll: 9999 });
    useGameStore.getState().signPlayer(target);

    const after = useGameStore.getState();
    const rivalAfter = after.league!.clubs.find((c) => c.id === rival.id)!;
    expect(after.owned).toContain(target); // you signed him
    expect(rivalAfter.squad).not.toContain(target); // off the rival's books
    expect(rivalAfter.squad!.length).toBe(beforeSquad); // lost one, re-signed one
    // The replacement is a real pool player now owned by the rival (left the pool).
    const replacement = rivalAfter.squad!.find((id) => !rival.squad!.includes(id))!;
    expect(replacement).toBeDefined();
    expect(after.owned).not.toContain(replacement);
  });
});
