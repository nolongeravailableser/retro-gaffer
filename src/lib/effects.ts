/**
 * The modifier layer — how between-round events and persistent relics warp a
 * match. Pure: takes the chemistry breakdown + a set of modifiers and returns
 * effective team strength. With NO_MODIFIERS it reproduces raw chemistry totals,
 * so it's a transparent extension point over computeChemistry/simulateMatch.
 */

import type { Role } from './types';
import type { PlayerChem } from './chemistry';

export interface MatchModifiers {
  /** Multiplier per role (default 1). */
  role: Partial<Record<Role, number>>;
  /** Multiplier per player id (form boosts/slumps). */
  player: Record<string, number>;
  /** Amplifies the chemistry bonus: effective = 1 + (mult-1) * chemAmplify. */
  chemAmplify: number;
  /** Flat whole-XI multiplier. */
  teamMult: number;
}

export const NO_MODIFIERS: MatchModifiers = {
  role: {},
  player: {},
  chemAmplify: 1,
  teamMult: 1,
};

/** Combine two modifier sets (multiplicatively). */
export function mergeModifiers(a: MatchModifiers, b: MatchModifiers): MatchModifiers {
  const role: Partial<Record<Role, number>> = { ...a.role };
  for (const k of Object.keys(b.role) as Role[]) {
    role[k] = (role[k] ?? 1) * (b.role[k] ?? 1);
  }
  const player: Record<string, number> = { ...a.player };
  for (const id of Object.keys(b.player)) {
    player[id] = (player[id] ?? 1) * b.player[id];
  }
  return {
    role,
    player,
    chemAmplify: a.chemAmplify * b.chemAmplify,
    teamMult: a.teamMult * b.teamMult,
  };
}

/**
 * Effective attack/defense for a starting XI under a set of modifiers.
 * `posMult` is an optional per-player out-of-position factor (1 = in position,
 * <1 = playing out of position) keyed by player id — see lib/positions.
 */
export function effectiveStrength(
  perPlayer: readonly PlayerChem[],
  mods: MatchModifiers = NO_MODIFIERS,
  posMult: Record<string, number> = {}
): { attack: number; defense: number } {
  let attack = 0;
  let defense = 0;
  for (const c of perPlayer) {
    const chem = 1 + (c.multiplier - 1) * mods.chemAmplify;
    const roleM = mods.role[c.player.role] ?? 1;
    const playerM = mods.player[c.player.id] ?? 1;
    const pos = posMult[c.player.id] ?? 1;
    const f = chem * roleM * playerM * mods.teamMult * pos;
    attack += c.player.stats.attack * f;
    defense += c.player.stats.defense * f;
  }
  return { attack: Math.round(attack), defense: Math.round(defense) };
}
