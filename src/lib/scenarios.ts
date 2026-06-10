/**
 * Scenarios — authored challenge puzzles. Each one is a fixed starting state
 * (prebuilt squad, bankroll, round, lives) plus a ModeConfig and a star rubric.
 * They reuse the whole engine wholesale: a scenario is mostly DATA.
 *
 * Pure & UI-agnostic. The store turns a Scenario into a run; the engine plays it
 * exactly as any other run, and `stars()` grades the finish.
 */

import { POOL } from '@/data/pool';
import { Rng } from './rng';
import { getFormation } from './formations';
import { XI_SIZE } from './types';
import { CLASSIC, type ModeConfig } from './modes';
import { resolveConfig } from './mutators';

/** How to fill a scenario's prebuilt XI. */
export interface SquadSpec {
  /** Deterministic seed for the draft. */
  seed: string;
  /** Inclusive cost band players are drawn from. */
  costMin: number;
  costMax: number;
  /** Leave this many XI slots empty (e.g. start a man light). */
  holes?: number;
}

/** Inputs the star rubric grades a finished scenario on. */
export interface ScenarioOutcome {
  livesRemaining: number;
  startingLives: number;
  peakBankroll: number;
  /** Score of the final match played. */
  lastScoreA: number;
  lastScoreB: number;
}

export interface Scenario {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** The ruleset for this challenge (built from CLASSIC with overrides). */
  config: ModeConfig;
  /** Round the run starts on. */
  startRound: number;
  formation: string;
  relics: string[];
  squad: SquadSpec;
  /** One-line win condition shown to the player. */
  objective: string;
  /** How the 1–3 stars are earned. */
  starText: string;
  /** Grade a finished (won) scenario, 1–3 stars. */
  stars: (o: ScenarioOutcome) => number;
}

/**
 * Deterministically fill an XI from the pool: for each slot, pick a not-yet-used
 * player of the required role within the cost band. Returns owned ids + the XI
 * layout (with `holes` trailing outfield slots left empty).
 */
export function buildScenarioSquad(
  formationId: string,
  spec: SquadSpec
): { owned: string[]; xi: (string | null)[] } {
  const formation = getFormation(formationId);
  const rng = new Rng(spec.seed);
  const used = new Set<string>();
  const xi: (string | null)[] = Array(XI_SIZE).fill(null);

  // Fill the GK slot (0) first, then outfield, so any holes fall on outfield.
  const order = [0, ...Array.from({ length: XI_SIZE - 1 }, (_, i) => i + 1)];
  const holes = spec.holes ?? 0;
  const toFill = XI_SIZE - holes;
  let filled = 0;

  for (const slot of order) {
    if (filled >= toFill && slot !== 0) continue; // keep the keeper, drop the rest
    const role = formation.slots[slot];
    const candidates = POOL.filter(
      (p) =>
        p.role === role &&
        p.cost >= spec.costMin &&
        p.cost <= spec.costMax &&
        !used.has(p.id)
    );
    if (candidates.length === 0) continue;
    const pick = candidates[rng.int(0, candidates.length - 1)];
    xi[slot] = pick.id;
    used.add(pick.id);
    filled++;
  }

  return { owned: [...used], xi };
}

/** Build a config from CLASSIC with the given overrides. */
function cfg(overrides: Partial<ModeConfig>): ModeConfig {
  return { ...CLASSIC, ...overrides };
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'smash_and_grab',
    name: 'Smash & Grab',
    emoji: '🥷',
    blurb: "It's the CL Final. One life, a shoestring squad, and the Invincibles await.",
    config: cfg({
      id: 'classic',
      name: 'Smash & Grab',
      scored: false,
      startingLives: 1,
      startingBankroll: 8,
      maxRounds: 12,
      finalMustWin: true,
    }),
    startRound: 12,
    formation: '442',
    relics: [],
    squad: { seed: 'sc-smash', costMin: 2, costMax: 3 },
    objective: 'Beat the Invincibles in the final.',
    starText: 'Win by 2+ for ★★★ · win to nil for ★★ · any win ★.',
    stars: (o) => {
      const margin = o.lastScoreA - o.lastScoreB;
      if (margin >= 2) return 3;
      if (o.lastScoreB === 0) return 2;
      return 1;
    },
  },
  {
    id: 'hold_the_line',
    name: 'Hold the Line',
    emoji: '🧱',
    blurb: 'Survive six rounds of an unforgiving, ever-steeper climb. Just stay alive.',
    config: cfg({
      id: 'classic',
      name: 'Hold the Line',
      scored: false,
      startingLives: 2,
      startingBankroll: 30,
      maxRounds: 6,
      finalMustWin: false,
      roundTarget: CLASSIC.roundTarget.map((v) => Math.round(v * 1.1)),
    }),
    startRound: 1,
    formation: '442',
    relics: [],
    squad: { seed: 'sc-hold', costMin: 2, costMax: 4 },
    objective: 'Survive to round 6 — wins not required.',
    starText: 'Finish with 2 lives for ★★★ · 1 life for ★★ · survive for ★.',
    stars: (o) => (o.livesRemaining >= 2 ? 3 : o.livesRemaining === 1 ? 2 : 1),
  },
  {
    id: 'giant_killing',
    name: 'Giant Killing',
    emoji: '🗡️',
    blurb: "Parachuted in at the Galacticos' door with a bargain squad. Slay them, then go all the way.",
    config: cfg({
      id: 'classic',
      name: 'Giant Killing',
      scored: false,
      startingLives: 2,
      startingBankroll: 15,
      maxRounds: 12,
      finalMustWin: true,
    }),
    startRound: 8,
    formation: '433',
    relics: [],
    squad: { seed: 'sc-giant', costMin: 2, costMax: 3 },
    objective: 'Beat the Galacticos at round 8, then win the final.',
    starText: 'Finish with 2 lives for ★★★ · 1 for ★★ · any win ★.',
    stars: (o) => (o.livesRemaining >= 2 ? 3 : o.livesRemaining === 1 ? 2 : 1),
  },
  {
    id: 'moneyball',
    name: 'Moneyball',
    emoji: '📉',
    blurb: 'A bargain-bin squad and almost no round income. Win by out-trading, not out-spending.',
    config: cfg({
      id: 'classic',
      name: 'Moneyball',
      scored: false,
      startingLives: 3,
      startingBankroll: 20,
      maxRounds: 12,
      finalMustWin: true,
      roundIncome: 1, // poverty football — interest and streaks are your wages
    }),
    startRound: 1,
    formation: '442',
    relics: [],
    squad: { seed: 'sc-money', costMin: 1, costMax: 2 },
    objective: 'Climb all 12 divisions on a shoestring income.',
    starText: 'Peak bankroll £45M+ for ★★★ · £30M+ for ★★ · any win ★.',
    stars: (o) => (o.peakBankroll >= 45 ? 3 : o.peakBankroll >= 30 ? 2 : 1),
  },
  {
    id: 'one_shot',
    name: 'One Shot',
    emoji: '🎯',
    blurb: 'A proper budget, a full season — and exactly one life. Perfection or nothing.',
    config: cfg({
      id: 'classic',
      name: 'One Shot',
      scored: false,
      startingLives: 1,
      startingBankroll: 50,
      maxRounds: 12,
      finalMustWin: true,
    }),
    startRound: 1,
    formation: '4231',
    relics: [],
    squad: { seed: 'sc-oneshot', costMin: 2, costMax: 4 },
    objective: 'Go unbeaten to the title — one defeat ends it.',
    starText: 'Win the final by 3+ for ★★★ · win it to nil for ★★ · any win ★.',
    stars: (o) => {
      if (o.lastScoreA - o.lastScoreB >= 3) return 3;
      if (o.lastScoreB === 0) return 2;
      return 1;
    },
  },
  {
    id: 'threadbare',
    name: 'Threadbare',
    emoji: '🩹',
    blurb: 'A broke club, a paper-thin squad a man light, and the whole pyramid to climb.',
    config: cfg({
      id: 'classic',
      name: 'Threadbare',
      scored: false,
      startingLives: 3,
      startingBankroll: 12,
      maxRounds: 12,
      finalMustWin: true,
    }),
    startRound: 1,
    formation: '442',
    relics: [],
    squad: { seed: 'sc-thread', costMin: 1, costMax: 2, holes: 1 },
    objective: 'Climb all 12 divisions and win the final.',
    starText: 'Finish with 3 lives for ★★★ · 2 for ★★ · any win ★.',
    stars: (o) => (o.livesRemaining >= 3 ? 3 : o.livesRemaining === 2 ? 2 : 1),
  },
];

const BY_ID: Record<string, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s])
);

export function getScenario(id: string | null | undefined): Scenario | null {
  return id ? BY_ID[id] ?? null : null;
}

/** Resolve the active ruleset for a run: scenario wins, else mode + mutator. */
export function runConfig(s: {
  scenario?: string | null;
  mode?: string | null;
  mutator?: string | null;
}): ModeConfig {
  const sc = getScenario(s.scenario);
  if (sc) return sc.config;
  return resolveConfig(s.mode, s.mutator);
}
