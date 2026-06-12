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

export type ModeId = 'classic' | 'endless' | 'league' | 'cup';

/** Teams in a league division → matchweeks = teams − 1. */
export const LEAGUE_TEAMS = 12;
export const LEAGUE_WEEKS = LEAGUE_TEAMS - 1; // 11

export interface ModeConfig {
  id: ModeId;
  name: string;
  blurb: string;
  /** Scored runs (Endless, Daily) show a numeric score instead of a win/lose. */
  scored: boolean;

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

  /**
   * Whether the final round must be WON to complete the run (Classic: beat the
   * Invincibles). When false, simply surviving to maxRounds with lives left
   * counts as a win — used by survival scenarios. Defaults to true when omitted.
   */
  finalMustWin?: boolean;
}

/** The original, shipped ruleset. Default for every run. */
export const CLASSIC: ModeConfig = {
  id: 'classic',
  name: 'Classic',
  blurb: 'Climb 12 divisions, 3 lives, beat the Invincibles.',
  scored: false,
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

/**
 * Endless / Survival: no finish line. Same difficulty curve and bosses, but the
 * climb never ends — opponents keep escalating past the curve (see
 * roundTargetStrength's overflow step) until you run out of lives. Scored by how
 * far you get.
 */
export const ENDLESS: ModeConfig = {
  id: 'endless',
  name: 'Endless',
  blurb: 'No final whistle — survive as long as you can. Scored by rounds reached.',
  scored: true,
  maxRounds: Infinity,
  startingLives: STARTING_LIVES,
  startingBankroll: STARTING_BANKROLL,
  roundIncome: ROUND_INCOME,
  roundTarget: ROUND_TARGET,
  roundTargetStep: ROUND_TARGET_STEP,
  bosses: BOSSES,
  engine: DEFAULT_TUNING,
  eventRates: DEFAULT_EVENT_RATES,
};

/**
 * League Season: a 12-team division played as a single round-robin (11
 * matchweeks) with a real table. No lives — your finishing position is the
 * result (champion = won). Opponents come from the league fixtures, not the
 * round-target curve. The league's own state (table/fixtures) lives in the
 * store; this config just sets the run shape + economy.
 */
export const LEAGUE: ModeConfig = {
  id: 'league',
  name: 'League Season',
  blurb: 'A 12-team division, home and away, a real table. Win the title.',
  scored: false,
  maxRounds: LEAGUE_WEEKS,
  startingLives: 1, // unused (no elimination); the season always completes
  startingBankroll: STARTING_BANKROLL,
  roundIncome: ROUND_INCOME,
  roundTarget: ROUND_TARGET,
  roundTargetStep: ROUND_TARGET_STEP,
  bosses: {}, // no bosses in a league
  engine: DEFAULT_TUNING,
  eventRates: DEFAULT_EVENT_RATES,
  finalMustWin: false,
};

/**
 * Cup: a standalone single-elimination knockout (8 clubs → 3 rounds). No lives
 * in the league sense — lose a tie and you're out (`finalMustWin` + the cup's own
 * elimination in the store). Win the final to lift the trophy. Uses the FM
 * transfer market to build a squad (like League); the bracket lives in the store.
 */
export const CUP_ROUNDS = 3; // 8 → QF, SF, Final
export const CUP: ModeConfig = {
  id: 'cup',
  name: 'Cup Run',
  blurb: 'A seeded knockout — win three ties to lift the cup. Lose one and you’re out.',
  scored: false,
  maxRounds: CUP_ROUNDS,
  startingLives: 1,
  startingBankroll: STARTING_BANKROLL,
  roundIncome: ROUND_INCOME,
  roundTarget: ROUND_TARGET,
  roundTargetStep: ROUND_TARGET_STEP,
  bosses: {},
  engine: DEFAULT_TUNING,
  eventRates: DEFAULT_EVENT_RATES,
  finalMustWin: true,
};

export const DEFAULT_MODE_ID: ModeId = 'classic';

/** Registry of all playable modes. */
export const MODES: Record<ModeId, ModeConfig> = {
  classic: CLASSIC,
  endless: ENDLESS,
  league: LEAGUE,
  cup: CUP,
};

/** Resolve a mode config by id, falling back to Classic for unknown ids. */
export function getMode(id: string | null | undefined): ModeConfig {
  return MODES[(id as ModeId)] ?? CLASSIC;
}
