/**
 * Boss rounds — fixed historic super-teams every 4th round. Unlike normal
 * rivals they do NOT scale to the player; they're absolute walls you must
 * out-build, with raised stakes (Pillar 3). Pure & deterministic.
 */

import { POOL } from '@/data/pool';
import { Rng } from './rng';
import { fictionalSquad } from './opponent';
import type { MatchTeam } from './engine';
import type { Player } from './types';

export interface Boss {
  round: number;
  name: string;
  era: string;
  /** Flavour rule shown in the UI. */
  ruleText: string;
  attack: number;
  defense: number;
  /** Lives lost on a defeat (bosses bite harder). */
  lifeCost: number;
  /** A draw counts as a loss. */
  suddenDeath: boolean;
  /** Pull a real themed XI from the pool for commentary, if matched. */
  squadFilter?: (p: Player) => boolean;
}

export const BOSSES: Record<number, Boss> = {
  4: {
    round: 4,
    name: '2008 Derby County',
    era: '2007/08',
    ruleText: "11 points all season — they're already on the beach. A gift.",
    attack: 230,
    defense: 220,
    lifeCost: 1,
    suddenDeath: false,
  },
  8: {
    round: 8,
    name: "Galacticos '03",
    era: '2002/03',
    ruleText: 'All-out attack, no holding midfielder. You must out-score them.',
    attack: 860,
    defense: 470,
    lifeCost: 2,
    suddenDeath: false,
    squadFilter: (p) => p.club === 'Real Madrid',
  },
  12: {
    round: 12,
    name: "Invincibles '04",
    era: '2003/04',
    ruleText: 'Unbeaten all season — a draw is not enough. Win, or go home.',
    attack: 820,
    defense: 800,
    lifeCost: 2,
    suddenDeath: true,
    squadFilter: (p) => p.tags.includes('invincibles'),
  },
};

export function getBoss(round: number): Boss | null {
  return BOSSES[round] ?? null;
}

export function isBoss(round: number): boolean {
  return round in BOSSES;
}

/** Build a boss's match team (themed real XI where possible, else fictional). */
export function bossTeam(round: number, seed: string | number): MatchTeam {
  const boss = BOSSES[round];
  const rng = new Rng(`${seed}-boss${round}`);
  let squad: Player[] = [];
  if (boss.squadFilter) {
    squad = rng.shuffle(POOL.filter(boss.squadFilter)).slice(0, 11);
  }
  if (squad.length < 11) {
    squad = [...squad, ...fictionalSquad(rng).slice(0, 11 - squad.length)];
  }
  return { name: boss.name, attack: boss.attack, defense: boss.defense, squad };
}
