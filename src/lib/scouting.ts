/**
 * Scout Discovery Network — paid, targeted shop rolls. Instead of hoping a
 * specific kind of player surfaces in a 1-in-500 draw, you brief a scout by a
 * criterion and the next shop is guaranteed to include a match. This is the
 * intentional-discovery layer over the random transfer market.
 *
 * A brief is just a predicate + a price; the store hands the predicate to
 * drawShop's `mustMatch`. Pure & UI-agnostic.
 */

import type { Player, Role } from './types';

export interface ScoutBrief {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  /** Cost in £m to dispatch this scout. */
  cost: number;
  /** A player satisfying the brief. */
  match: (p: Player) => boolean;
}

const role = (r: Role) => (p: Player) => p.role === r;

export const SCOUT_BRIEFS: ScoutBrief[] = [
  {
    id: 'goalkeeper',
    label: 'Goalkeeper',
    emoji: '🧤',
    blurb: 'Find a keeper for an open net.',
    cost: 3,
    match: role('GK'),
  },
  {
    id: 'defender',
    label: 'Defender',
    emoji: '🛡️',
    blurb: 'Shore up the back line.',
    cost: 3,
    match: role('DEF'),
  },
  {
    id: 'midfielder',
    label: 'Midfielder',
    emoji: '⚙️',
    blurb: 'Take control of the middle.',
    cost: 3,
    match: role('MID'),
  },
  {
    id: 'forward',
    label: 'Forward',
    emoji: '🎯',
    blurb: 'Bring in some firepower.',
    cost: 3,
    match: role('FWD'),
  },
  {
    id: 'star',
    label: 'A Star',
    emoji: '⭐',
    blurb: 'Scout a gold-or-better marquee name.',
    cost: 6,
    match: (p) => p.rarity === 'gold' || p.rarity === 'icon',
  },
  {
    id: 'cult_hero',
    label: 'Cult Hero',
    emoji: '😎',
    blurb: "Track down one the streets won't forget.",
    cost: 4,
    match: (p) => p.tags.includes('cult_hero'),
  },
  {
    id: 'hidden_gem',
    label: 'Hidden Gem',
    emoji: '💎',
    blurb: 'Unearth a true easter-egg — the unfindable ones.',
    cost: 8,
    match: (p) => p.tags.includes('easter_egg'),
  },
];

const BY_ID: Record<string, ScoutBrief> = Object.fromEntries(
  SCOUT_BRIEFS.map((b) => [b.id, b])
);

export function getBrief(id: string | null | undefined): ScoutBrief | null {
  return id ? BY_ID[id] ?? null : null;
}
