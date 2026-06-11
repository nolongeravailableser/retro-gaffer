/**
 * League-Season mode — a single round-robin division with a real table.
 *
 * Pure & deterministic: the fixtures, the AI clubs and every AI-vs-AI result
 * derive from the run seed, so a league replays identically (Daily/share-safe).
 * The player's own fixture each matchweek is played by the real match engine;
 * the OTHER fixtures are resolved here by a light strength-based score model
 * (building 11 full AI squads per week would be overkill).
 *
 * The player is always team id `YOU`. Coordinates with the store, which holds
 * the LeagueState and advances `matchweek`.
 */

import { Rng } from './rng';
import { expectedGoals } from './engine';

/** The player's fixed team id in the table. */
export const YOU = 'YOU';

/**
 * The English football pyramid (Career mode). Tier 1 = the summit; climbing a
 * tier raises the AI strength base, so each promotion is a real step up. Win the
 * top tier to be champions of the land.
 */
export interface Division {
  /** 1 (top) … N (bottom). */
  tier: number;
  name: string;
  /** AI strength base (ATK+DEF) for clubs in this division. */
  baseStrength: number;
}

export const DIVISIONS: Division[] = [
  { tier: 5, name: 'National League', baseStrength: 900 },
  { tier: 4, name: 'League Two', baseStrength: 1080 },
  { tier: 3, name: 'League One', baseStrength: 1260 },
  { tier: 2, name: 'Championship', baseStrength: 1450 },
  { tier: 1, name: 'Premier League', baseStrength: 1650 },
];

export const BOTTOM_TIER = Math.max(...DIVISIONS.map((d) => d.tier)); // 5
export const TOP_TIER = Math.min(...DIVISIONS.map((d) => d.tier)); // 1
/** Top N promoted, bottom N relegated (out of 12). */
export const PROMOTION_SPOTS = 3;
export const RELEGATION_SPOTS = 3;

export function division(tier: number): Division {
  return DIVISIONS.find((d) => d.tier === tier) ?? DIVISIONS[0];
}

export type SeasonOutcome = 'champion' | 'promoted' | 'stay' | 'relegated' | 'sacked';

/**
 * What a finishing position in a tier means. Top tier: 1st = champion (the
 * goal), top spots otherwise just "stay". Bottom tier: the drop zone gets you
 * sacked (nowhere lower). Elsewhere: top spots promote, bottom spots relegate.
 */
export function seasonOutcome(tier: number, finishPos: number, clubs: number): SeasonOutcome {
  const relegated = finishPos > clubs - RELEGATION_SPOTS;
  if (tier === TOP_TIER) {
    if (finishPos === 1) return 'champion';
    return relegated ? 'relegated' : 'stay';
  }
  if (finishPos <= PROMOTION_SPOTS) return 'promoted';
  if (relegated) return tier === BOTTOM_TIER ? 'sacked' : 'relegated';
  return 'stay';
}

/** The tier you start the next season in, given this season's outcome. */
export function nextTier(tier: number, outcome: SeasonOutcome): number {
  if (outcome === 'promoted' || outcome === 'champion') return Math.max(TOP_TIER, tier - 1);
  if (outcome === 'relegated') return Math.min(BOTTOM_TIER, tier + 1);
  return tier; // stay / sacked (run over)
}

export interface LeagueClub {
  id: string;
  name: string;
  /** Combined attack+defense rating used for AI-vs-AI sims (not the player). */
  strength: number;
  /** Pool player ids this club owns (Phase B). Empty for YOU. You can poach
   *  these (for a premium, weakening the club); they're not free agents. */
  squad?: string[];
}

/** Minimal player shape the squad-assigner needs (avoids a lib/wages cycle). */
interface RatedPlayer {
  id: string;
  role: string;
  stats: { attack: number; defense: number };
}

/** Role targets for a generated AI club squad (14 — a full XI + cover). */
export const CLUB_SQUAD_NEED: Record<string, number> = { GK: 1, DEF: 5, MID: 5, FWD: 3 };

/**
 * Give each AI club a real, seeded squad drafted from `pool`: clubs draft in
 * strength order (strongest first), greedily taking the best available player
 * per still-needed role. So the title favourites own the galácticos and the
 * minnows get journeymen — and the players a club owns are NOT free agents (you
 * must poach them). YOU (the player) drafts nothing here — you build your own.
 * Mutates `clubs` in place. Deterministic given the draft order.
 */
export function assignClubSquads(clubs: LeagueClub[], pool: readonly RatedPlayer[]): void {
  const rank = (p: RatedPlayer) => p.stats.attack + p.stats.defense;
  const byRole = new Map<string, RatedPlayer[]>();
  for (const p of pool) {
    (byRole.get(p.role) ?? byRole.set(p.role, []).get(p.role)!).push(p);
  }
  for (const arr of byRole.values()) arr.sort((a, b) => rank(b) - rank(a)); // best first
  const cursor = new Map<string, number>(); // next index per role

  const aiClubs = clubs.filter((c) => c.id !== YOU).sort((a, b) => b.strength - a.strength);
  for (const club of aiClubs) {
    const squad: string[] = [];
    for (const [role, need] of Object.entries(CLUB_SQUAD_NEED)) {
      const arr = byRole.get(role) ?? [];
      let i = cursor.get(role) ?? 0;
      for (let n = 0; n < need && i < arr.length; n++, i++) squad.push(arr[i].id);
      cursor.set(role, i);
    }
    club.squad = squad;
  }
}

export interface Fixture {
  matchweek: number;
  home: string;
  away: string;
}

export interface LeagueResult {
  home: number;
  away: number;
}

export interface LeagueState {
  clubs: LeagueClub[];
  fixtures: Fixture[];
  /** fixtureKey (`mw-home-away`) → score, for matchweeks already played. */
  results: Record<string, LeagueResult>;
  /** 1-based; the matchweek about to be played. > totalWeeks ⇒ season done. */
  matchweek: number;
}

export interface TableRow {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

const CLUB_NAMES = [
  'Northgate Rovers', 'Selby Athletic', 'Marsh Town', 'Kingsford United',
  'Pemberton FC', 'Ravenhill City', 'Ashcombe Wanderers', 'Dewsworth Albion',
  'Halloway Town', 'Brockmoor FC', 'Thornbury United', 'Castleford Park',
  'Edenvale FC', 'Whitlow Rovers', 'Granby Athletic', 'Lytham Borough',
];

export function fixtureKey(f: Fixture): string {
  return `${f.matchweek}-${f.home}-${f.away}`;
}

/**
 * Circle-method single round-robin for an even number of teams → n-1
 * matchweeks, each a full set of n/2 fixtures, balanced home/away by week.
 */
export function roundRobin(teamIds: string[]): Fixture[] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push('__BYE__'); // shouldn't happen (we use 12)
  const n = ids.length;
  const weeks = n - 1;
  const half = n / 2;
  const rot = ids.slice(1); // first team fixed, rest rotate
  const fixtures: Fixture[] = [];
  for (let w = 0; w < weeks; w++) {
    const order = [ids[0], ...rot];
    for (let i = 0; i < half; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a === '__BYE__' || b === '__BYE__') continue;
      // Alternate home/away by week + slot so it isn't all one-sided.
      const homeFirst = (w + i) % 2 === 0;
      fixtures.push({
        matchweek: w + 1,
        home: homeFirst ? a : b,
        away: homeFirst ? b : a,
      });
    }
    rot.unshift(rot.pop()!); // rotate
  }
  return fixtures;
}

/** Build a fresh league: the player (YOU) + (size-1) seeded AI clubs. */
export function generateLeague(
  seed: string | number,
  playerStrength: number,
  size = 12
): LeagueState {
  const rng = new Rng(`${seed}-league`);
  // Pick distinct club names deterministically.
  const names = [...CLUB_NAMES];
  const clubs: LeagueClub[] = [{ id: YOU, name: YOU, strength: playerStrength }];
  for (let i = 0; i < size - 1; i++) {
    const idx = rng.int(0, names.length - 1);
    const name = names.splice(idx, 1)[0] ?? `Club ${i + 1}`;
    // Spread AI strengths around the player's level so the table has a real
    // spine of rivals — some weaker, some stronger.
    const factor = 0.7 + rng.next() * 0.6; // 0.7×–1.3×
    clubs.push({ id: `ai${i}`, name, strength: Math.round(playerStrength * factor) });
  }
  const fixtures = roundRobin(clubs.map((c) => c.id));
  return { clubs, fixtures, results: {}, matchweek: 1 };
}

export function totalWeeks(state: LeagueState): number {
  return state.clubs.length - 1;
}

// --- Transfer windows ------------------------------------------------------

/** Summer window: open for the opening matchweeks of a season (pre-season + early). */
export const SUMMER_WINDOW_WEEKS = 3;

/** The single mid-season ("winter") matchweek the window briefly reopens on. */
export function winterWindowWeek(weeks: number): number {
  return Math.max(SUMMER_WINDOW_WEEKS + 1, Math.round(weeks / 2));
}

/**
 * Whether the transfer window is open for a given matchweek. Mirrors football's
 * two windows: a long summer window over the opening weeks, then a brief winter
 * one mid-season. Closed otherwise — you can't sign or sell until it reopens.
 */
export function isWindowOpen(matchweek: number, weeks: number): boolean {
  return matchweek <= SUMMER_WINDOW_WEEKS || matchweek === winterWindowWeek(weeks);
}

/**
 * The next matchweek (≥ the current one) on which the window is open, or null if
 * it won't reopen before the season ends. Returns the current week if already open.
 */
export function nextWindowOpensAt(matchweek: number, weeks: number): number | null {
  for (let w = matchweek; w <= weeks; w++) if (isWindowOpen(w, weeks)) return w;
  return null;
}

/** Every pool-player id owned by an AI club (so they're excluded from free agents). */
export function allClubOwnedIds(state: LeagueState): Set<string> {
  const ids = new Set<string>();
  for (const c of state.clubs) for (const id of c.squad ?? []) ids.add(id);
  return ids;
}

/** The AI club that owns a player (a poach target), or null if unowned/free. */
export function clubOf(state: LeagueState, playerId: string): LeagueClub | null {
  return state.clubs.find((c) => c.id !== YOU && (c.squad ?? []).includes(playerId)) ?? null;
}

/** The player's fixture for a given matchweek (or null on a bye/none). */
export function playerFixture(state: LeagueState, matchweek: number): Fixture | null {
  return state.fixtures.find(
    (f) => f.matchweek === matchweek && (f.home === YOU || f.away === YOU)
  ) ?? null;
}

/** A deterministic AI-vs-AI score from two strengths (light xG model). */
export function simAiResult(
  strengthHome: number,
  strengthAway: number,
  seed: string | number
): LeagueResult {
  const rng = new Rng(`${seed}-ai`);
  const HOME_ADV = 1.1;
  const xgH = expectedGoals(strengthHome * HOME_ADV, strengthAway);
  const xgA = expectedGoals(strengthAway, strengthHome * HOME_ADV);
  const draw = (xg: number) => {
    // Sum of independent per-"shot" chances ≈ a small Poisson-ish goal count.
    let goals = 0;
    for (let i = 0; i < 6; i++) if (rng.next() < xg / 6) goals++;
    return goals;
  };
  return { home: draw(xgH), away: draw(xgA) };
}

/**
 * Resolve every non-player fixture in `matchweek` and return the score map to
 * merge into `results`. Deterministic per (seed, matchweek, fixture).
 */
export function simAiWeek(
  state: LeagueState,
  matchweek: number,
  seed: string | number
): Record<string, LeagueResult> {
  const byId = new Map(state.clubs.map((c) => [c.id, c]));
  const out: Record<string, LeagueResult> = {};
  for (const f of state.fixtures) {
    if (f.matchweek !== matchweek) continue;
    if (f.home === YOU || f.away === YOU) continue; // player plays this for real
    const h = byId.get(f.home)!;
    const a = byId.get(f.away)!;
    out[fixtureKey(f)] = simAiResult(h.strength, a.strength, `${seed}-${fixtureKey(f)}`);
  }
  return out;
}

/** Standings from the results so far, sorted by points → GD → GF → name. */
export function table(state: LeagueState): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const c of state.clubs) {
    rows.set(c.id, {
      teamId: c.id, name: c.name,
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
    });
  }
  const apply = (teamId: string, scored: number, conceded: number) => {
    const r = rows.get(teamId);
    if (!r) return;
    r.played++;
    r.gf += scored;
    r.ga += conceded;
    r.gd = r.gf - r.ga;
    if (scored > conceded) { r.won++; r.points += 3; }
    else if (scored === conceded) { r.drawn++; r.points += 1; }
    else r.lost++;
  };
  for (const f of state.fixtures) {
    const res = state.results[fixtureKey(f)];
    if (!res) continue;
    apply(f.home, res.home, res.away);
    apply(f.away, res.away, res.home);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name)
  );
}

/** 1-based finishing/current position of a team in the table. */
export function position(state: LeagueState, teamId: string): number {
  return table(state).findIndex((r) => r.teamId === teamId) + 1;
}
