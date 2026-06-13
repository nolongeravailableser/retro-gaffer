/**
 * Chemistry / synergy calculation. Pure, UI-agnostic.
 *
 * Rule: for each tag, if 2+ starters share it, that tag becomes an active
 * synergy. Every starter holding an active tag gets +10% to BOTH attack and
 * defense PER active tag they hold (additive stacking — two shared tags = +20%,
 * not +21%). `era` is display-only and never contributes.
 */

import type { Player } from './types';

export const SYNERGY_BONUS = 0.1;
/** A synergy needs at least this many starters sharing the tag. */
export const SYNERGY_THRESHOLD = 2;

/**
 * Humanize a raw tag key for display: `red_devils` → "Red Devils",
 * `cult_hero` → "Cult Hero", `treble_99` → "Treble 99". A few acronyms
 * stay upper-cased so they don't read as "Cm Legend".
 */
const TAG_ACRONYMS: Record<string, string> = { cm: 'CM', mls: 'MLS', usa: 'USA' };
export function tagLabel(tag: string): string {
  return tag
    .split('_')
    .map((w) => TAG_ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Per-player chemistry contribution. */
export interface PlayerChem {
  player: Player;
  /** Active tags this player holds (drives the multiplier). */
  sharedTags: string[];
  /** 1 + SYNERGY_BONUS * sharedTags.length. */
  multiplier: number;
  /** Boosted attack (raw float — round only for display). */
  attack: number;
  /** Boosted defense (raw float — round only for display). */
  defense: number;
}

/** One active synergy lighting up the board. */
export interface Synergy {
  tag: string;
  /** Number of starters sharing this tag (>= SYNERGY_THRESHOLD). */
  count: number;
  playerIds: string[];
}

export interface ChemistryResult {
  perPlayer: PlayerChem[];
  synergies: Synergy[];
  /** Sum of boosted attack across all starters. */
  totalAttack: number;
  /** Sum of boosted defense across all starters. */
  totalDefense: number;
}

/**
 * Compute chemistry for a set of starters. Order-independent and pure.
 * Pass however many starters exist (0–11); partial XIs are valid.
 */
export function computeChemistry(starters: readonly Player[]): ChemistryResult {
  // Tally which players hold each synergy key (curated tags + club + nation).
  const tagToPlayers = new Map<string, string[]>();
  for (const p of starters) {
    for (const tag of p.synergyTags ?? p.tags) {
      const ids = tagToPlayers.get(tag);
      if (ids) ids.push(p.id);
      else tagToPlayers.set(tag, [p.id]);
    }
  }

  // Active tags = held by >= threshold starters.
  const activeTags = new Set<string>();
  const synergies: Synergy[] = [];
  for (const [tag, ids] of tagToPlayers) {
    if (ids.length >= SYNERGY_THRESHOLD) {
      activeTags.add(tag);
      synergies.push({ tag, count: ids.length, playerIds: ids });
    }
  }
  // Stable, useful ordering: strongest first, then alphabetical.
  synergies.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  let totalAttack = 0;
  let totalDefense = 0;
  const perPlayer: PlayerChem[] = starters.map((player) => {
    const sharedTags = (player.synergyTags ?? player.tags).filter((t) =>
      activeTags.has(t)
    );
    const multiplier = 1 + SYNERGY_BONUS * sharedTags.length;
    const attack = player.stats.attack * multiplier;
    const defense = player.stats.defense * multiplier;
    totalAttack += attack;
    totalDefense += defense;
    return { player, sharedTags, multiplier, attack, defense };
  });

  return { perPlayer, synergies, totalAttack, totalDefense };
}
