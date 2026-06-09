/**
 * Roguelike "Season" ladder. A run is a climb up the football pyramid: each
 * round is a tougher PvE opponent. Win to bank prize money + interest + streak
 * bonuses; lose and you drop a life. Reach the top to win the run; hit 0 lives
 * and you're sacked. Pure & UI-agnostic.
 */

import { Rng } from './rng';
import { generateOpponent } from './opponent';
import { getBoss, bossTeam, type BossSchedule } from './bosses';
import type { MatchTeam } from './engine';

export const MAX_ROUNDS = 12;
export const STARTING_LIVES = 3;
/** Guaranteed cash each round, on top of the match result reward. */
export const ROUND_INCOME = 3;

/** Division names as you climb the pyramid (index = round - 1). */
const TIERS = [
  'Sunday League',
  'Non-League',
  'League Two',
  'League One',
  'Championship',
  'Promotion Play-off',
  'Premier League',
  'Top Half',
  'European Places',
  'Champions League',
  'CL Semi-Final',
  'CL Final',
];

export function ladderTier(round: number): string {
  return TIERS[Math.min(round, TIERS.length) - 1] ?? 'The Big Time';
}

/** Short label for a career-best round (0 = none yet). */
export function bestLabel(round: number): string {
  if (round <= 0) return '—';
  if (round >= MAX_ROUNDS) return 'Champion';
  return ladderTier(round);
}

/**
 * Absolute opponent strength (ATK+DEF) per round — a fixed "power budget" the
 * player must out-build, NOT a rubber-band scaled to the player. This is the
 * core fix for flatness: you can fall behind, and you can pull ahead.
 */
export const ROUND_TARGET = [
  380, 500, 620, 720, 900, 1010, 1120, 1320, 1300, 1390, 1480, 1600,
];

/** Per-round strength step applied past the end of the curve. */
export const ROUND_TARGET_STEP = 130;

export function roundTargetStrength(
  round: number,
  target: readonly number[] = ROUND_TARGET,
  step: number = ROUND_TARGET_STEP
): number {
  const last = target[target.length - 1] ?? 0;
  return target[round - 1] ?? last + (round - target.length) * step;
}

/** Banking is strong: +£1 per £8 saved, capped at £8 — rewards greed (Pillar 2). */
export function interest(bankroll: number): number {
  return Math.min(8, Math.floor(bankroll / 8));
}

/** Win-streak bonus: +£1 per consecutive win, capped at £6 — and it resets hard
 *  to 0 on any non-win (handled in the store). Big upside, brutal downside. */
export function streakBonus(streak: number): number {
  return Math.min(6, Math.max(0, streak));
}

/** Squad slots that are wage-free. Beyond this, each owned player taxes income. */
export const WAGE_FREE_SLOTS = 13;

/** Upkeep charged each round for a bloated squad (anti-hoarding). */
export function wageBill(ownedCount: number): number {
  return Math.max(0, ownedCount - WAGE_FREE_SLOTS);
}

/** Max stake for the pre-match Gaffer's Gamble: half your bankroll. */
export function maxWager(bankroll: number): number {
  return Math.floor(Math.max(0, bankroll) / 2);
}

/** Escalating cost to buy back a lost life: £8, £16, £24, … */
export function lifeBuybackCost(buybacks: number): number {
  return 8 * (Math.max(0, buybacks) + 1);
}

export interface RoundIncome {
  reward: number; // match result payout
  income: number; // flat round income
  interest: number;
  streak: number; // streak bonus
  total: number;
}

/** Compute the cash a result pays out (does not mutate anything). */
export function roundPayout(
  outcome: 'win' | 'draw' | 'loss',
  bankroll: number,
  matchReward: number,
  newStreak: number
): RoundIncome {
  const reward = matchReward;
  const income = ROUND_INCOME;
  const intr = interest(bankroll);
  const sb = outcome === 'win' ? streakBonus(newStreak) : 0;
  return { reward, income, interest: intr, streak: sb, total: reward + income + intr + sb };
}

/**
 * Build this round's opponent. Boss rounds (4/8/12) return a fixed historic
 * super-team; normal rounds use the ABSOLUTE strength curve with only a ±10%
 * anti-frustration nudge toward the player's level. Deterministic per seed.
 */
export interface LadderShape {
  /** Absolute strength curve (ATK+DEF) per round. */
  roundTarget?: readonly number[];
  /** Boss schedule keyed by round. */
  bosses?: BossSchedule;
}

export function buildRoundOpponent(
  playerAttack: number,
  playerDefense: number,
  round: number,
  runSeed: string | number,
  shape: LadderShape = {}
): MatchTeam {
  const bosses = shape.bosses;
  if (getBoss(round, bosses)) return bossTeam(round, `${runSeed}-R${round}`, bosses);

  const seed = `${runSeed}-R${round}`;
  const base = generateOpponent(playerAttack, playerDefense, seed);
  const target = roundTargetStrength(round, shape.roundTarget);
  const playerTotal = playerAttack + playerDefense || 1;
  // Mostly absolute: clamp the relative pull to ±10%.
  const nudge = 1 + 0.1 * Math.max(-1, Math.min(1, playerTotal / target - 1));
  const total = target * nudge;
  const rng = new Rng(`${seed}-split`);
  const atkShare = 0.48 + rng.next() * 0.08; // 0.48–0.56
  return {
    name: base.name,
    attack: Math.round(total * atkShare),
    defense: Math.round(total * (1 - atkShare)),
    squad: base.squad,
  };
}
