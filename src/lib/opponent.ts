/**
 * PvE opponent generation. Pure & seeded: a given seed yields the same rival.
 * Scaled to the player's strength so matches stay competitive. Uses its OWN
 * fictional name bank so a rival never borrows the player's real squad.
 * (Phase-4 PvP imports bypass this entirely.)
 */

import type { Player, Role } from './types';
import { Rng } from './rng';
import type { MatchTeam } from './engine';

const RIVAL_NAMES = [
  'Wanderers AFC',
  'Albion Rovers',
  'Real Sociopaths',
  'Dynamo Disappointment',
  'Athletic Hangover',
  'Sporting Mediocre',
  'Inter Pub League',
  'FC Relegation',
  'Hartlepool Galacticos',
  'Accrington Stanley XI',
];

// Fictional pros — pastiche of 2000s–2010s journeymen, never real pool players.
const RIVAL_FIRST = [
  'Gazza', 'Deano', 'Macca', 'Robbo', 'Tommo', 'Sparky', 'Razor', 'Chopper',
  'Sicknote', 'Tinkerman', 'Bullet', 'Dazza', 'Lurch', 'Tank', 'Psycho',
  'Bambi', 'Mad Dog', 'The Cat', 'Rocky', 'Trigger',
];
const RIVAL_LAST = [
  'McTackle', 'Smithington', 'Boggins', 'Hollowlegs', 'Pemberton', 'Crouchley',
  'Bumble', 'Stainrod', 'Fitzhammer', 'Oakenfold', 'Drinkwater', 'Hardcastle',
  'Quagmire', 'Pluckley', 'Snodgrass', 'Wobblethorpe', 'Tunstall', 'Birtwhistle',
];

const ROLE_SPINE: Role[] = [
  'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD',
];

export function fictionalSquad(rng: Rng): Player[] {
  const first = rng.shuffle(RIVAL_FIRST);
  const last = rng.shuffle(RIVAL_LAST);
  return ROLE_SPINE.map((role, i) => ({
    id: `rival_${i}`,
    name: `${first[i % first.length]} ${last[i % last.length]}`,
    era: '20XX',
    cost: 0,
    stats: { attack: 50, defense: 50 },
    tags: [],
    role,
    rarity: 'bronze' as const,
  }));
}

/**
 * Build a rival roughly mirroring the player's strength, with per-side variance
 * so it isn't a clone. Floors keep a near-empty XI facing someone.
 */
export function generateOpponent(
  playerAttack: number,
  playerDefense: number,
  seed: number | string
): MatchTeam {
  const rng = new Rng(seed);
  const name = rng.pick(RIVAL_NAMES);

  const attackFactor = 0.82 + rng.next() * 0.36; // 0.82–1.18
  const defenseFactor = 0.82 + rng.next() * 0.36;

  const attack = Math.max(60, Math.round(playerAttack * attackFactor));
  const defense = Math.max(60, Math.round(playerDefense * defenseFactor));

  return { name, attack, defense, squad: fictionalSquad(rng) };
}
