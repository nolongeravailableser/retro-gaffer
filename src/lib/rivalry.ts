/**
 * Rivalries (narrative-scoped) — when you meet a club you've already faced this
 * season, the return fixture carries history: a win to defend, a defeat to
 * avenge. Pure & deterministic, read straight from the league results; no
 * mechanics (the reputation/morale PAYOFF is a separate, balance-sensitive
 * follow-up). Just the texture FM never frames: "they did you 3-0 last time".
 */

import { fixtureKey, YOU, type LeagueState } from './league';

export interface Meeting {
  mw: number;
  youScored: number;
  oppScored: number;
  /** Were you the home side that meeting? */
  home: boolean;
}

export interface HeadToHead {
  meetings: Meeting[];
  wins: number;
  draws: number;
  losses: number;
}

/** Your played meetings with `oppId` this season (the reverse-fixture history). */
export function headToHead(league: LeagueState, oppId: string): HeadToHead {
  const meetings: Meeting[] = [];
  let wins = 0, draws = 0, losses = 0;
  for (const f of league.fixtures) {
    const isMeeting = (f.home === YOU && f.away === oppId) || (f.home === oppId && f.away === YOU);
    if (!isMeeting) continue;
    const r = league.results[fixtureKey(f)];
    if (!r) continue; // not played yet
    const youHome = f.home === YOU;
    const youScored = youHome ? r.home : r.away;
    const oppScored = youHome ? r.away : r.home;
    meetings.push({ mw: f.matchweek, youScored, oppScored, home: youHome });
    if (youScored > oppScored) wins++;
    else if (youScored < oppScored) losses++;
    else draws++;
  }
  return { meetings, wins, draws, losses };
}

/**
 * A narrative line for the rematch — revenge for a defeat, a win to repeat, a
 * draw to settle — or null if this is the first meeting of the season.
 */
export function rivalryLine(h: HeadToHead, oppName: string): string | null {
  if (h.meetings.length === 0) return null;
  const last = h.meetings[h.meetings.length - 1];
  if (last.youScored > last.oppScored) {
    return `You won the reverse fixture ${last.youScored}–${last.oppScored} — do it again.`;
  }
  if (last.youScored < last.oppScored) {
    return `${oppName} beat you ${last.oppScored}–${last.youScored} last time — revenge?`;
  }
  return `${last.youScored}–${last.oppScored} when you last met — settle it.`;
}
