/**
 * Shop "Packs": themed draw pools that filter the 500-strong player base so
 * finding a specific player (or building a themed squad) is strategic rather
 * than a 1-in-500 fluke. Pure & UI-agnostic — the store filters POOL by a
 * pack's predicate and draws with rarity weighting (+ optional guarantee).
 */

import type { Player, Rarity } from './types';

export interface Pack {
  id: string;
  name: string;
  blurb: string;
  /** Cost in £m to refresh this pack. */
  cost: number;
  /** Which players this pack can draw. */
  filter: (p: Player) => boolean;
  /** If set, at least one drawn slot is guaranteed to be >= this tier. */
  guarantee?: Rarity;
}

export type Decade = '90s' | '00s' | '10s' | '20s';

/** Start year of a 'YYYY/YY' season, or null. */
export function seasonStartYear(peak?: string): number | null {
  if (!peak) return null;
  const y = parseInt(peak.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function decadeOf(p: Player): Decade | null {
  const y = seasonStartYear(p.peak_season);
  if (y == null) return null;
  if (y < 2000) return '90s';
  if (y < 2010) return '00s';
  if (y < 2020) return '10s';
  return '20s';
}

const inLeague =
  (lg: Player['league']) =>
  (p: Player): boolean =>
    p.league === lg;

const inDecade =
  (d: Decade) =>
  (p: Player): boolean =>
    decadeOf(p) === d;

export const PACKS: Pack[] = [
  { id: 'all', name: 'All-Stars', blurb: 'The full pool.', cost: 1, filter: () => true },
  { id: 'epl', name: 'Premier League', blurb: 'English top flight.', cost: 1, filter: inLeague('EPL') },
  { id: 'laliga', name: 'La Liga', blurb: 'Spanish top flight.', cost: 1, filter: inLeague('LaLiga') },
  { id: 'seriea', name: 'Serie A', blurb: 'Italian top flight.', cost: 1, filter: inLeague('SerieA') },
  { id: '90s', name: '90s Legends', blurb: 'Peaked 1992–1999.', cost: 1, filter: inDecade('90s') },
  { id: '00s', name: 'Noughties', blurb: 'Peaked 2000–2009.', cost: 1, filter: inDecade('00s') },
  { id: '10s', name: '2010s', blurb: 'Peaked 2010–2019.', cost: 1, filter: inDecade('10s') },
  { id: '20s', name: 'Modern', blurb: 'Peaked 2020+.', cost: 1, filter: inDecade('20s') },
  { id: 'cult', name: 'Cult Heroes', blurb: "Streets won't forget.", cost: 1, filter: (p) => p.tags.includes('cult_hero') },
  {
    id: 'icons',
    name: 'Icon Pack',
    blurb: 'Gold & Icons only — guaranteed Icon.',
    cost: 3,
    filter: (p) => p.rarity === 'gold' || p.rarity === 'icon',
    guarantee: 'icon',
  },
];

const BY_ID = new Map(PACKS.map((p) => [p.id, p]));

export function getPack(id?: string | null): Pack {
  return (id && BY_ID.get(id)) || PACKS[0];
}
