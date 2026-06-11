import { describe, it, expect } from 'vitest';
import { matchRatings, accrueHistory, avgRating, type RatingContext } from '@/lib/ratings';
import type { MatchEvent, Player, Role } from '@/lib/types';

function p(id: string, role: Role): Player {
  return {
    id,
    name: id,
    era: '2010',
    cost: 4,
    stats: { attack: 60, defense: 60 },
    tags: [],
    role,
    rarity: 'silver',
  };
}

const squad: Player[] = [
  p('gk', 'GK'),
  p('df1', 'DEF'),
  p('df2', 'DEF'),
  p('mf1', 'MID'),
  p('fw1', 'FWD'),
];

const goalBy = (playerId: string, assistId?: string): MatchEvent => ({
  minute: 30,
  side: 'A',
  kind: 'goal',
  text: 'GOAL',
  playerId,
  assistId,
});

const baseCtx: RatingContext = { goalsConceded: 0, outcome: 'win', seed: 'seed-1' };
const get = (rs: ReturnType<typeof matchRatings>, id: string) => rs.find((r) => r.playerId === id)!;

describe('matchRatings', () => {
  it('is deterministic for the same inputs', () => {
    const a = matchRatings([goalBy('fw1')], squad, baseCtx);
    const b = matchRatings([goalBy('fw1')], squad, baseCtx);
    expect(a).toEqual(b);
  });

  it('rewards a goalscorer over an uninvolved teammate', () => {
    const rs = matchRatings([goalBy('fw1')], squad, baseCtx);
    expect(get(rs, 'fw1').rating).toBeGreaterThan(get(rs, 'mf1').rating);
    expect(get(rs, 'fw1').goals).toBe(1);
  });

  it('credits the assister', () => {
    const withAssist = matchRatings([goalBy('fw1', 'mf1')], squad, baseCtx);
    const without = matchRatings([goalBy('fw1')], squad, baseCtx);
    expect(get(withAssist, 'mf1').assists).toBe(1);
    expect(get(withAssist, 'mf1').rating).toBeGreaterThan(get(without, 'mf1').rating);
  });

  it('a red card tanks the rating', () => {
    const red: MatchEvent = { minute: 50, side: 'A', kind: 'red', text: 'RED', playerId: 'mf1' };
    const rs = matchRatings([red], squad, baseCtx);
    expect(get(rs, 'mf1').red).toBe(true);
    expect(get(rs, 'mf1').rating).toBeLessThan(6);
  });

  it('a clean sheet lifts the back line; conceding hurts the keeper most', () => {
    const clean = matchRatings([], squad, { ...baseCtx, goalsConceded: 0 });
    const leaky = matchRatings([], squad, { ...baseCtx, goalsConceded: 3, outcome: 'loss' });
    expect(get(clean, 'gk').rating).toBeGreaterThan(get(leaky, 'gk').rating);
    expect(get(clean, 'df1').rating).toBeGreaterThan(get(leaky, 'df1').rating);
    // the keeper swings more than an outfielder for the same scoreline change
    const gkSwing = get(clean, 'gk').rating - get(leaky, 'gk').rating;
    const mfSwing = get(clean, 'mf1').rating - get(leaky, 'mf1').rating;
    expect(gkSwing).toBeGreaterThan(mfSwing);
  });

  it('accrues history across matches (apps, goals, assists, avg rating)', () => {
    let hist: Record<string, ReturnType<typeof accrueHistory>[string]> = {};
    // Match 1: fw1 scores, mf1 assists.
    hist = accrueHistory(hist, [goalBy('fw1', 'mf1')], squad, baseCtx);
    // Match 2: fw1 scores again.
    hist = accrueHistory(hist, [goalBy('fw1')], squad, { ...baseCtx, seed: 'seed-2' });

    expect(hist['fw1'].apps).toBe(2);
    expect(hist['fw1'].goals).toBe(2);
    expect(hist['mf1'].apps).toBe(2);
    expect(hist['mf1'].assists).toBe(1);
    expect(hist['gk'].apps).toBe(2);
    expect(hist['gk'].goals).toBe(0);
    // Average is the running mean of the two match ratings.
    const fwAvg = avgRating(hist['fw1']);
    expect(fwAvg).not.toBeNull();
    expect(fwAvg!).toBeGreaterThan(6);
    expect(avgRating({ apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0, motm: 0, ratingSum: 0 })).toBeNull();
  });

  it('clamps to 3.0–10.0 and names exactly one MOTM', () => {
    const manyGoals = [goalBy('fw1'), goalBy('fw1'), goalBy('fw1'), goalBy('fw1'), goalBy('fw1')];
    const rs = matchRatings(manyGoals, squad, baseCtx);
    for (const r of rs) {
      expect(r.rating).toBeGreaterThanOrEqual(3.0);
      expect(r.rating).toBeLessThanOrEqual(10.0);
    }
    expect(rs.filter((r) => r.motm).length).toBe(1);
    expect(get(rs, 'fw1').motm).toBe(true); // the 5-goal hero
  });
});
