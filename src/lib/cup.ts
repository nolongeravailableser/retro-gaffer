/**
 * Cup mode — a seeded single-elimination knockout (standalone). Pure &
 * deterministic: the field, the bracket and every AI-vs-AI tie derive from the
 * run seed. YOU play your tie each round with the real match engine; the other
 * ties are resolved by the light strength model (`simAiResult`). Win or go home;
 * lift the trophy by winning the final.
 *
 * Reuses the league's club generation (`generateLeague`) and AI sim, so the cup
 * is a thin bracket layer over machinery that already exists.
 */

import { Rng } from './rng';
import {
  generateLeague,
  simAiResult,
  YOU,
  type LeagueClub,
  type LeagueResult,
} from './league';

export interface CupState {
  /** YOU + (size−1) seeded AI clubs. */
  clubs: LeagueClub[];
  /** Bracket size (a power of two). */
  size: number;
  /** 1-based current round. */
  round: number;
  /** Total rounds = log2(size). */
  rounds: number;
  /** Surviving club ids, in bracket order (adjacent pairs meet). */
  alive: string[];
  /** Results by `${round}-${home}-${away}`. */
  results: Record<string, LeagueResult>;
}

export interface CupTie {
  round: number;
  home: string;
  away: string;
}

/** Default field size — 8 clubs → 3 rounds (QF → SF → Final). Snappy. */
export const CUP_SIZE = 8;

export function cupTieKey(round: number, home: string, away: string): string {
  return `${round}-${home}-${away}`;
}

/** Human name for a round, counting back from the final. */
export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round; // 0 = final
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-final';
  if (fromEnd === 2) return 'Quarter-final';
  return `Round ${round}`;
}

/** Build a fresh cup: YOU + (size−1) seeded clubs, bracket order shuffled. */
export function generateCup(seed: string | number, playerStrength: number, size = CUP_SIZE): CupState {
  // Reuse the league generator purely for its seeded clubs (its fixtures unused).
  const { clubs } = generateLeague(`${seed}-cup`, playerStrength, size);
  const rng = new Rng(`${seed}-cup-draw`);
  const alive = rng.shuffle(clubs.map((c) => c.id)); // seeded bracket draw
  return { clubs, size, round: 1, rounds: Math.round(Math.log2(size)), alive, results: {} };
}

/** The ties for the current round (adjacent survivors). */
export function cupTies(state: CupState): CupTie[] {
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < state.alive.length; i += 2) {
    ties.push({ round: state.round, home: state.alive[i], away: state.alive[i + 1] });
  }
  return ties;
}

/** YOUR tie this round (or null if you've been eliminated). */
export function playerTie(state: CupState): CupTie | null {
  return cupTies(state).find((t) => t.home === YOU || t.away === YOU) ?? null;
}

// --- Career integration: a domestic cup interleaved with the league season ----

/**
 * League matchweeks each knockout round is played on, for the Career cup. The cup
 * is an interleaved EXTRA tie (a midweek game) — the league matchweek does NOT
 * advance on a cup tie, so a season is its 22 league games plus up to one tie per
 * round survived. One entry per round (CUP_SIZE 8 → QF/SF/Final at 6/12/18).
 */
export const CAREER_CUP_ROUND_WEEKS = [6, 12, 18];

/**
 * Is the player's cup tie due now, given the league matchweek? True only while the
 * player is still in the cup and the current round's matchweek has arrived — so the
 * opponent/resolve logic plays the cup tie instead of the league fixture this game.
 */
export function careerCupDue(state: CupState, leagueMatchweek: number): boolean {
  if (state.round > state.rounds) return false; // cup concluded
  if (!playerTie(state)) return false; // eliminated / no tie this round
  const at = CAREER_CUP_ROUND_WEEKS[state.round - 1];
  return at !== undefined && leagueMatchweek >= at;
}

/** Did YOU lift the trophy (sole survivor after the final)? */
export function cupChampion(state: CupState): boolean {
  return state.round > state.rounds && state.alive.length === 1 && state.alive[0] === YOU;
}

/** Decide a tie's winner from a score — level ties go to seeded "penalties". */
export function tieWinner(home: string, away: string, res: LeagueResult, seed: string | number): string {
  if (res.home > res.away) return home;
  if (res.away > res.home) return away;
  return new Rng(`${seed}-pens`).next() < 0.5 ? home : away; // shootout
}

/**
 * Resolve a whole round given YOUR result, advancing the survivors. Returns the
 * next bracket (alive in order), the merged results, and whether YOU went through.
 * AI ties are simmed; the player's tie uses the provided real-engine result.
 */
export function resolveCupRound(
  state: CupState,
  playerResult: LeagueResult | null,
  seed: string | number
): { alive: string[]; results: Record<string, LeagueResult>; playerThrough: boolean } {
  const byId = new Map(state.clubs.map((c) => [c.id, c]));
  const results = { ...state.results };
  const winners: string[] = [];
  let playerThrough = false;

  for (const tie of cupTies(state)) {
    const isPlayer = tie.home === YOU || tie.away === YOU;
    const tieSeed = `${seed}-${cupTieKey(tie.round, tie.home, tie.away)}`;
    const res =
      isPlayer && playerResult
        ? playerResult
        : simAiResult(byId.get(tie.home)!.strength, byId.get(tie.away)!.strength, tieSeed);
    results[cupTieKey(tie.round, tie.home, tie.away)] = res;
    const winner = tieWinner(tie.home, tie.away, res, tieSeed);
    winners.push(winner);
    if (isPlayer && winner === YOU) playerThrough = true;
  }

  return { alive: winners, results, playerThrough };
}
