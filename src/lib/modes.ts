/**
 * Game-mode configuration — the Phase 0 keystone.
 *
 * Every rule that *could* differ between modes lives here as data, not as a
 * hardcoded constant scattered across the engine. A `ModeConfig` bundles the
 * run shape (length, lives, economy), the difficulty curve, the boss schedule,
 * the match-engine feel, and the event deck. The pure lib functions all accept
 * these as optional arguments (defaulting to the classic values), so a mode is
 * just a different `ModeConfig` threaded through the same engine.
 *
 * CLASSIC is assembled FROM the existing constants, so there is a single source
 * of truth and no risk of drift: changing a classic constant changes the preset.
 */

import {
  MAX_ROUNDS,
  STARTING_LIVES,
  ROUND_INCOME,
  ROUND_TARGET,
  ROUND_TARGET_STEP,
} from './ladder';
import { STARTING_BANKROLL } from './economy';
import { BOSSES, type BossSchedule } from './bosses';
import { DEFAULT_TUNING, type EngineTuning } from './engine';
import { DEFAULT_EVENT_RATES, type EventRates } from './events';

export type ModeId = 'classic';

export interface ModeConfig {
  id: ModeId;
  name: string;
  blurb: string;

  // --- run shape ---
  /** Rounds to climb to win the run. */
  maxRounds: number;
  /** Lives you start with; 0 ends the run. */
  startingLives: number;
  /** Opening bankroll (£m). */
  startingBankroll: number;
  /** Guaranteed cash each round, on top of the match reward. */
  roundIncome: number;

  // --- difficulty ---
  /** Absolute opponent strength (ATK+DEF) per round. */
  roundTarget: readonly number[];
  /** Strength step applied past the end of the curve. */
  roundTargetStep: number;
  /** Boss schedule keyed by round. */
  bosses: BossSchedule;

  // --- match feel ---
  engine: EngineTuning;

  // --- between-round events ---
  eventRates: EventRates;
}

/** The original, shipped ruleset. Default for every run. */
export const CLASSIC: ModeConfig = {
  id: 'classic',
  name: 'Classic',
  blurb: 'Climb 12 divisions, 3 lives, beat the Invincibles.',
  maxRounds: MAX_ROUNDS,
  startingLives: STARTING_LIVES,
  startingBankroll: STARTING_BANKROLL,
  roundIncome: ROUND_INCOME,
  roundTarget: ROUND_TARGET,
  roundTargetStep: ROUND_TARGET_STEP,
  bosses: BOSSES,
  engine: DEFAULT_TUNING,
  eventRates: DEFAULT_EVENT_RATES,
};

export const DEFAULT_MODE_ID: ModeId = 'classic';

/** Registry of all playable modes. */
export const MODES: Record<ModeId, ModeConfig> = {
  classic: CLASSIC,
};

/** Resolve a mode config by id, falling back to Classic for unknown ids. */
export function getMode(id: string | null | undefined): ModeConfig {
  return MODES[(id as ModeId)] ?? CLASSIC;
}
