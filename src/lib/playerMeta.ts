/**
 * Display helpers for player metadata. Pure, UI-agnostic (no React).
 *
 * Surfaces the rich authored fields (granular position, league) that the data
 * model carries but the coarse Role bucket hides.
 */

import type { Position, League } from './types';

/** Humanised label for the granular authored position. */
const POSITION_LABELS: Record<Position, string> = {
  Goalkeeper: 'Goalkeeper',
  CenterBack: 'Centre-Back',
  Fullback: 'Full-Back',
  Anchor: 'Anchor',
  BoxToBox: 'Box-to-Box',
  Playmaker: 'Playmaker',
  Winger: 'Winger',
  Striker: 'Striker',
};

export function positionLabel(position?: Position): string | null {
  return position ? POSITION_LABELS[position] : null;
}

/** Short league badge label. */
const LEAGUE_LABELS: Record<League, string> = {
  EPL: 'Premier League',
  LaLiga: 'La Liga',
  SerieA: 'Serie A',
};

export function leagueLabel(league?: League): string | null {
  return league ? LEAGUE_LABELS[league] : null;
}

/** Compact league code for tight badges (ENG/ESP/ITA). */
const LEAGUE_CODES: Record<League, string> = {
  EPL: 'EPL',
  LaLiga: 'LIGA',
  SerieA: 'SERIE A',
};

export function leagueCode(league?: League): string | null {
  return league ? LEAGUE_CODES[league] : null;
}

/** Qualitative tier for a 0–99 stat, used to colour bars and show a word. */
export interface StatTier {
  word: string;
  /** Tailwind text colour for the tier word. */
  text: string;
  /** Tailwind bg colour for the filled bar. */
  bar: string;
}

export function statTier(value: number): StatTier {
  if (value >= 85) return { word: 'Elite', text: 'text-crt-green', bar: 'bg-crt-green' };
  if (value >= 70) return { word: 'Strong', text: 'text-emerald-300', bar: 'bg-emerald-400' };
  if (value >= 55) return { word: 'Solid', text: 'text-amber-300', bar: 'bg-amber-400' };
  if (value >= 40) return { word: 'Fair', text: 'text-orange-300', bar: 'bg-orange-400' };
  return { word: 'Weak', text: 'text-rose-300', bar: 'bg-rose-400' };
}
