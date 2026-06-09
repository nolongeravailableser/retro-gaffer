/**
 * Run scoring for the competitive modes (Endless, Daily Gauntlet). Pure.
 *
 * A single comparable number so two runs of the same mode/day can be ranked.
 * Rounds reached dominate (that's the real achievement); bankroll, win streak,
 * and total wins are tie-breakers. A completed Classic-style win banks a bonus.
 */

export interface ScoreInput {
  /** Furthest round reached. */
  round: number;
  runStatus: 'playing' | 'won' | 'lost';
  /** Highest bankroll reached this run. */
  peakBankroll: number;
  bestStreak: number;
  record: { w: number; d: number; l: number };
  /** The mode's finish line (Infinity for Endless). */
  maxRounds: number;
}

/**
 * Weights chosen so a deeper run ALWAYS outranks a shallower one: bankroll,
 * streak and wins are tie-breakers, capped below one round's value so they can
 * order runs of equal depth but never leapfrog a deeper run. A completed win
 * banks a bonus on top.
 */
const PER_ROUND = 10000;
const WIN_BONUS = 5000;
const PER_BANKROLL = 5;
const PER_STREAK = 50;
const PER_WIN = 20;

export function runScore(i: ScoreInput): number {
  const reached =
    i.runStatus === 'won' && Number.isFinite(i.maxRounds) ? i.maxRounds : i.round;
  const winBonus = i.runStatus === 'won' ? WIN_BONUS : 0;
  const tieBreakers = Math.min(
    PER_ROUND - 1,
    i.peakBankroll * PER_BANKROLL + i.bestStreak * PER_STREAK + i.record.w * PER_WIN
  );
  return reached * PER_ROUND + winBonus + tieBreakers;
}

/** Grouped thousands for display, e.g. 12345 → "12,345". */
export function formatScore(score: number): string {
  return score.toLocaleString('en-US');
}
