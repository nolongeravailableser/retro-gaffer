/**
 * "The world moves" — your ex-players have lives after they leave you. Every
 * player you sell, cash in on, or lose on a Bosman is remembered; seasons later
 * the inbox tells you how they're getting on. FM continues the world silently;
 * we surface the emotional payoff — the kid you sold winning a trophy, the
 * veteran you cut dropping down the leagues ("you called that one right").
 *
 * Pure & seeded → Daily-safe. A player's fate is weighted by the quality they
 * had when they left, then locked by the season seed (same save → same story).
 */

import { Rng } from './rng';

export interface Alumnus {
  id: string;
  name: string;
  /** Season they left your club (career season number). */
  season: number;
  /** Overall when they left — drives how likely they are to thrive. */
  ovr: number;
}

/** Keep the alumni list bounded (newest departures matter most). */
export const ALUMNI_CAP = 24;

/** Remember a departed player. De-duped by id (first leaving wins); capped. */
export function recordAlumnus(alumni: readonly Alumnus[], a: Alumnus): Alumnus[] {
  if (alumni.some((x) => x.id === a.id)) return alumni as Alumnus[];
  return [a, ...alumni].slice(0, ALUMNI_CAP);
}

export interface AlumniNews {
  alumnusId: string;
  title: string;
  body: string;
}

/**
 * A deterministic "where are they now" story about one ex-player, or null when
 * there's nobody who's had a season elsewhere yet. Picks a recent alumnus
 * (seeded) and gives them a fate weighted by the quality they left at — stars
 * are likelier to win things, journeymen to fade.
 */
export function alumniNews(
  alumni: readonly Alumnus[],
  season: number,
  seed: string | number
): AlumniNews | null {
  // They need at least one season elsewhere before there's news to tell.
  const eligible = alumni.filter((a) => a.season < season);
  if (eligible.length === 0) return null;

  const rng = new Rng(`${seed}-alumni-${season}`);
  const a = eligible[rng.int(0, eligible.length - 1)];
  const yrs = season - a.season;
  const ago = `${yrs} season${yrs === 1 ? '' : 's'} ago`;
  const roll = rng.next();
  const star = a.ovr >= 80;
  const decent = a.ovr >= 70;

  let body: string;
  if (star && roll < 0.5) {
    body = `${a.name}, who left you ${ago}, has just won a major trophy. The one that got away?`;
  } else if (decent && roll < 0.55) {
    body = `${a.name} is starring at his new club — a bargain, in hindsight. You let him go ${ago}.`;
  } else if (!decent && roll < 0.4) {
    body = `${a.name} has slid down the divisions since leaving ${ago} — you called that one right.`;
  } else {
    body = `${a.name} is ticking along since he left ${ago} — neither lighting it up nor sorely missed.`;
  }
  return { alumnusId: a.id, title: 'Where are they now?', body };
}
