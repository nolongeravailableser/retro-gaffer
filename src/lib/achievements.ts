/**
 * Achievements — all-time badges evaluated when a ladder round resolves.
 * Pure: the store builds a snapshot of the just-resolved round and asks which
 * locked achievements now unlock. Unlocks persist across runs (like the
 * collection) and surface in the Records trophy cabinet.
 */

import type { MatchResult } from './types';

/** Everything a check may look at — the post-resolve state of the round. */
export interface AchievementSnapshot {
  /** The match that just resolved. */
  result: MatchResult;
  /** Outcome AFTER boss sudden-death adjustment. */
  outcome: 'win' | 'draw' | 'loss';
  /** The round that was just played. */
  round: number;
  /** Run status AFTER resolution. */
  runStatus: 'playing' | 'won' | 'lost';
  /** True when this round was a boss. */
  boss: boolean;
  lives: number;
  bankroll: number;
  streak: number;
  /** Total cost of every owned player. */
  squadValue: number;
  scenario: string | null;
  daily: boolean;
  endless: boolean;
  /** Career seasons fully completed (careerBest after this resolve). */
  careerSeasons: number;
}

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  check: (s: AchievementSnapshot) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    emoji: '⚽',
    blurb: 'Win a ladder match.',
    check: (s) => s.outcome === 'win',
  },
  {
    id: 'champions',
    name: 'Champions of Europe',
    emoji: '🏆',
    blurb: 'Win a full Classic climb.',
    check: (s) => s.runStatus === 'won' && !s.scenario && !s.endless && !s.daily,
  },
  {
    id: 'daily_winner',
    name: 'Gauntlet Conqueror',
    emoji: '🗓️',
    blurb: 'Win a Daily Gauntlet outright.',
    check: (s) => s.daily && s.runStatus === 'won',
  },
  {
    id: 'giant_slayer',
    name: 'Giant Slayer',
    emoji: '🗡️',
    blurb: 'Beat a boss.',
    check: (s) => s.boss && s.outcome === 'win',
  },
  {
    id: 'fortress',
    name: 'The Fortress',
    emoji: '🧱',
    blurb: 'Beat a boss without conceding.',
    check: (s) => s.boss && s.outcome === 'win' && s.result.score.b === 0,
  },
  {
    id: 'goal_rush',
    name: 'Goal Rush',
    emoji: '🎆',
    blurb: 'Score five in one match.',
    check: (s) => s.result.score.a >= 5,
  },
  {
    id: 'ten_men',
    name: 'Ten-Man Wall',
    emoji: '🟥',
    blurb: 'Win a match in which you were shown a red card.',
    check: (s) => s.outcome === 'win' && s.result.suspensions.length > 0,
  },
  {
    id: 'hot_streak',
    name: 'Hot Streak',
    emoji: '🔥',
    blurb: 'Win six on the bounce.',
    check: (s) => s.streak >= 6,
  },
  {
    id: 'tycoon',
    name: 'Oil Money',
    emoji: '💰',
    blurb: 'Hold £100M at once.',
    check: (s) => s.bankroll >= 100,
  },
  {
    id: 'bargain_bucket',
    name: 'Bargain Bucket',
    emoji: '🪣',
    blurb: 'Win a match with a squad worth £25M or less.',
    check: (s) => s.outcome === 'win' && s.squadValue > 0 && s.squadValue <= 25,
  },
  {
    id: 'on_the_brink',
    name: 'On the Brink',
    emoji: '💀',
    blurb: 'Win a match while on your last life.',
    check: (s) => s.outcome === 'win' && s.lives === 1,
  },
  {
    id: 'marathon_man',
    name: 'Marathon Man',
    emoji: '🏃',
    blurb: 'Reach round 15 in Endless.',
    check: (s) => s.endless && s.round >= 15,
  },
  {
    id: 'daily_grind',
    name: 'The Daily Grind',
    emoji: '📅',
    blurb: 'Finish a Daily Gauntlet.',
    check: (s) => s.daily && s.runStatus !== 'playing',
  },
  {
    id: 'dynasty',
    name: 'Dynasty',
    emoji: '👑',
    blurb: 'Survive three Career seasons.',
    check: (s) => s.careerSeasons >= 3,
  },
  {
    id: 'challenge_taker',
    name: 'Puzzle Solver',
    emoji: '🧩',
    blurb: 'Complete any scenario.',
    check: (s) => s.runStatus === 'won' && !!s.scenario,
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: string): Achievement | null {
  return BY_ID.get(id) ?? null;
}

/** Which locked achievements does this round's snapshot unlock? Pure. */
export function newlyUnlocked(
  unlocked: readonly string[],
  snap: AchievementSnapshot
): string[] {
  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(snap)).map((a) => a.id);
}
