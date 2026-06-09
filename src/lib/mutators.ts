/**
 * Run mutators — optional run-long modifiers that reshape a ModeConfig before a
 * run starts. A mutator is a pure transform `(config) => config`, so it composes
 * with any mode: applying "Glass Cannon" to Classic or Endless just returns a
 * config with a higher xG scale. Pure & UI-agnostic.
 *
 * The Daily Gauntlet uses `dailyMutator()` to pick a deterministic "Rule of the
 * Day", so everyone playing the same date faces the same twist.
 */

import { hashSeed } from './rng';
import { getMode, type ModeConfig, type ModeId } from './modes';

export interface Mutator {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Pure transform applied to the base mode config. */
  apply: (config: ModeConfig) => ModeConfig;
}

export const MUTATORS: Mutator[] = [
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    emoji: '🔥',
    blurb: 'Goals galore — chances fly in at both ends.',
    apply: (c) => ({
      ...c,
      engine: { ...c.engine, xgScale: c.engine.xgScale * 1.6, maxXg: c.engine.maxXg * 1.6 },
    }),
  },
  {
    id: 'low_block',
    name: 'Low Block',
    emoji: '🛡️',
    blurb: 'Cagey, low-scoring grind — every goal is precious.',
    apply: (c) => ({
      ...c,
      engine: { ...c.engine, xgScale: c.engine.xgScale * 0.6 },
    }),
  },
  {
    id: 'carnage',
    name: 'Carnage',
    emoji: '🤕',
    blurb: 'Cards and injuries everywhere — manage your squad depth.',
    apply: (c) => ({
      ...c,
      engine: {
        ...c.engine,
        pYellow: c.engine.pYellow * 1.6,
        pStraightRed: c.engine.pStraightRed * 2.5,
        pInjury: c.engine.pInjury * 2.2,
      },
    }),
  },
  {
    id: 'underdog',
    name: 'Underdog',
    emoji: '💪',
    blurb: 'Start broke — half the opening budget.',
    apply: (c) => ({ ...c, startingBankroll: Math.round(c.startingBankroll * 0.5) }),
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    emoji: '💰',
    blurb: 'Rich start and fatter round income.',
    apply: (c) => ({
      ...c,
      startingBankroll: Math.round(c.startingBankroll * 1.4),
      roundIncome: c.roundIncome + 2,
    }),
  },
  {
    id: 'last_stand',
    name: 'Last Stand',
    emoji: '❤️',
    blurb: 'One life. No second chances.',
    apply: (c) => ({ ...c, startingLives: 1 }),
  },
  {
    id: 'steep_climb',
    name: 'Steep Climb',
    emoji: '📈',
    blurb: 'Every opponent is 15% stronger.',
    apply: (c) => ({
      ...c,
      roundTarget: c.roundTarget.map((v) => Math.round(v * 1.15)),
      roundTargetStep: Math.round(c.roundTargetStep * 1.15),
    }),
  },
  {
    id: 'relic_hunter',
    name: 'Relic Hunter',
    emoji: '🎲',
    blurb: 'Backroom deals everywhere — far more relic offers.',
    apply: (c) => ({
      ...c,
      eventRates: { meta: 0.3, metaOrForm: 0.55 },
    }),
  },
];

const BY_ID: Record<string, Mutator> = Object.fromEntries(
  MUTATORS.map((m) => [m.id, m])
);

export function getMutator(id: string | null | undefined): Mutator | null {
  return id ? BY_ID[id] ?? null : null;
}

/** Apply a mutator (by id) to a config. Unknown/null id returns the config as-is. */
export function applyMutator(config: ModeConfig, mutatorId: string | null | undefined): ModeConfig {
  const m = getMutator(mutatorId);
  return m ? m.apply(config) : config;
}

/** Resolve the full ruleset for a run: base mode + optional mutator. */
export function resolveConfig(
  modeId: string | null | undefined,
  mutatorId: string | null | undefined
): ModeConfig {
  return applyMutator(getMode(modeId), mutatorId);
}

/** Deterministic "Rule of the Day" for the Daily Gauntlet. */
export function dailyMutator(dateKey: string): string {
  const idx = hashSeed(`gaffer-daily-mutator-${dateKey}`) % MUTATORS.length;
  return MUTATORS[idx].id;
}

export type { ModeId };
