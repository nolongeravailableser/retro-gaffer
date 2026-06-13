/**
 * "The world moves" — the generative half. Beyond your ex-players' fortunes
 * (alumni.ts), the wider world keeps turning: the clubs you used to manage rise
 * and fall without you, and old players you sold eventually move into the
 * dugout. Pure & seeded → Daily-safe; narrative-only, no mechanics.
 *
 * Derived entirely from data already tracked (the alumni list + the career
 * history's per-season club), so no new persisted state.
 */

import { Rng } from './rng';
import type { Alumnus } from './alumni';

export interface WorldNewsItem {
  /** Stable id segment (unique within a season) for the inbox message. */
  key: string;
  title: string;
  body: string;
}

export interface WorldNewsCtx {
  alumni: readonly Alumnus[];
  /** Distinct clubs you managed before — NOT your current one. */
  pastClubs: readonly string[];
  season: number;
  seed: string | number;
}

/** A star you sold needs a couple of seasons before he turns up in management. */
const MANAGER_MIN_OVR = 78;
const MANAGER_SEASONS_AGO = 2;

/**
 * One world-news beat for the season, or null. Picks (seeded) between an old
 * club's changing fortunes and an ex-player stepping into management — so a
 * multi-club, well-travelled manager gets a richer, living world.
 */
export function worldNews(ctx: WorldNewsCtx): WorldNewsItem | null {
  const rng = new Rng(`${ctx.seed}-world-${ctx.season}`);
  const beats: WorldNewsItem[] = [];

  // Ex-player → manager (rare; stars who left a while ago).
  const mgrCandidates = ctx.alumni.filter(
    (a) => a.ovr >= MANAGER_MIN_OVR && a.season <= ctx.season - MANAGER_SEASONS_AGO
  );
  if (mgrCandidates.length > 0 && rng.next() < 0.45) {
    const a = mgrCandidates[rng.int(0, mgrCandidates.length - 1)];
    beats.push({
      key: `exmgr-${a.id}`,
      title: 'Into the dugout',
      body: `${a.name}, who once played for you, has taken his first job in management. The circle turns.`,
    });
  }

  // An old club's fortunes since you left.
  if (ctx.pastClubs.length > 0) {
    const club = ctx.pastClubs[rng.int(0, ctx.pastClubs.length - 1)];
    const roll = rng.next();
    const fate =
      roll < 0.34
        ? 'have won promotion — thriving since you left.'
        : roll < 0.67
          ? 'have slipped toward the drop without you in charge.'
          : 'are ticking along in mid-table since your departure.';
    beats.push({ key: `oldclub-${club}`, title: 'Your old club', body: `${club} ${fate}` });
  }

  if (beats.length === 0) return null;
  return beats[rng.int(0, beats.length - 1)];
}

/** Distinct clubs from the career history, excluding the current one. */
export function pastClubsOf(
  history: readonly { club?: string }[],
  currentClub: string | null
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rec of history) {
    const c = rec.club;
    if (c && c !== currentClub && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
