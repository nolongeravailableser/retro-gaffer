import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS,
  newlyUnlocked,
  getAchievement,
  type AchievementSnapshot,
} from '@/lib/achievements';
import type { MatchResult } from '@/lib/types';

function result(over: Partial<MatchResult> = {}): MatchResult {
  return {
    events: [],
    score: { a: 1, b: 0 },
    xg: { a: 1.2, b: 0.8 },
    outcome: 'win',
    suspensions: [],
    injuries: [],
    ...over,
  };
}

/** A mundane mid-run win. */
function snap(over: Partial<AchievementSnapshot> = {}): AchievementSnapshot {
  return {
    result: result(),
    outcome: 'win',
    round: 3,
    runStatus: 'playing',
    boss: false,
    lives: 3,
    bankroll: 40,
    streak: 2,
    squadValue: 45,
    scenario: null,
    daily: false,
    endless: false,
    careerSeasons: 0,
    ...over,
  };
}

describe('achievement checks', () => {
  it('a mundane draw unlocks nothing', () => {
    const s = snap({ outcome: 'draw', result: result({ outcome: 'draw', score: { a: 1, b: 1 } }) });
    expect(newlyUnlocked([], s)).toEqual([]);
  });

  it('a first win unlocks First Blood (and only the earned set)', () => {
    expect(newlyUnlocked([], snap())).toEqual(['first_blood']);
  });

  it('already-unlocked achievements are not re-awarded', () => {
    expect(newlyUnlocked(['first_blood'], snap())).toEqual([]);
  });

  it('unlocks the boss pair on a clean-sheet boss win', () => {
    const ids = newlyUnlocked(['first_blood'], snap({ boss: true }));
    expect(ids).toContain('giant_slayer');
    expect(ids).toContain('fortress'); // score.b === 0
  });

  it('conceding boss win unlocks Giant Slayer but not The Fortress', () => {
    const s = snap({ boss: true, result: result({ score: { a: 3, b: 1 } }) });
    const ids = newlyUnlocked(['first_blood'], s);
    expect(ids).toContain('giant_slayer');
    expect(ids).not.toContain('fortress');
  });

  it('checks the rest of the cabinet', () => {
    const all: [string, AchievementSnapshot][] = [
      ['champions', snap({ runStatus: 'won' })],
      ['goal_rush', snap({ result: result({ score: { a: 5, b: 1 } }) })],
      ['ten_men', snap({ result: result({ suspensions: ['p1'] }) })],
      ['hot_streak', snap({ streak: 6 })],
      ['tycoon', snap({ bankroll: 100 })],
      ['bargain_bucket', snap({ squadValue: 22 })],
      ['on_the_brink', snap({ lives: 1 })],
      ['marathon_man', snap({ endless: true, round: 15 })],
      ['daily_grind', snap({ daily: true, runStatus: 'lost', outcome: 'loss', result: result({ outcome: 'loss', score: { a: 0, b: 2 } }) })],
      ['daily_winner', snap({ daily: true, runStatus: 'won' })],
      ['dynasty', snap({ careerSeasons: 3 })],
      ['challenge_taker', snap({ runStatus: 'won', scenario: 'one_shot' })],
    ];
    for (const [id, s] of all) {
      expect(newlyUnlocked([], s), id).toContain(id);
    }
  });

  it('Champions requires Classic (not endless, scenario, or Daily)', () => {
    expect(newlyUnlocked([], snap({ runStatus: 'won', endless: true }))).not.toContain('champions');
    expect(newlyUnlocked([], snap({ runStatus: 'won', scenario: 'x' }))).not.toContain('champions');
    expect(newlyUnlocked([], snap({ runStatus: 'won', daily: true }))).not.toContain('champions');
  });

  it('every achievement has unique id and resolvable metadata', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getAchievement(id)?.name).toBeTruthy();
    expect(getAchievement('nope')).toBeNull();
  });
});
