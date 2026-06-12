/**
 * Classic Draft League balance harness (Monte-Carlo). Run: `npm run sim`.
 *
 * Plays many full draft leagues against the REAL logic — a snake draft (every
 * team, including YOU, drafting competently via the shipped AI), the drafted
 * squads converted into a single round-robin league, and the season simulated
 * with the real match engine (your fixtures) + the light AI-vs-AI model.
 *
 * The questions: does the draft always complete (no stranding)? Does the
 * DIFFICULTY budget actually matter — i.e. does a bigger budget draft a stronger
 * squad and win more? And is the league competitive at every difficulty (never a
 * guaranteed win or a hopeless one)?
 */

import { describe, it, expect } from 'vitest';
import { POOL } from '@/data/pool';
import { computeChemistry } from '@/lib/chemistry';
import { simulateMatch, type MatchTeam } from '@/lib/engine';
import { generateOpponent } from '@/lib/opponent';
import {
  generateDraft, aiPick, applyPick, draftComplete, currentTeam,
  leagueFromDraft, draftedStrength, CLASSIC_DRAFT_BUDGET,
  AI_DRAFT_BUDGET, AI_BUDGET_LO, AI_BUDGET_HI,
  type DraftablePlayer,
} from '@/lib/draft';
import {
  position, playerFixture, fixtureKey, simAiWeek, totalWeeks, YOU,
  type LeagueResult,
} from '@/lib/league';
import { baseValue } from '@/lib/market';
import { getDifficulty, type DifficultyId } from '@/lib/difficulty';
import { Rng } from '@/lib/rng';
import type { Player, Role } from '@/lib/types';

const LEAGUE_TEAMS = 12;
const byId = new Map(POOL.map((p) => [p.id, p]));

function draftablePool(): DraftablePlayer[] {
  return POOL.map((p) => ({
    id: p.id, role: p.role,
    rating: p.stats.attack + p.stats.defense,
    value: Math.max(1, baseValue(p)),
  }));
}

const XI_FORM: Record<Role, number> = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
/** A legal 4-4-2 XI from a roster — best by rating per role. */
function bestXI(roster: Player[]): Player[] {
  const xi: Player[] = [];
  for (const [role, n] of Object.entries(XI_FORM) as [Role, number][]) {
    const ofRole = roster
      .filter((p) => p.role === role)
      .sort((a, b) => b.stats.attack + b.stats.defense - (a.stats.attack + a.stats.defense));
    xi.push(...ofRole.slice(0, n));
  }
  return xi;
}

interface RunResult { pos: number; yourStr: number; avgStr: number; completed: boolean }

function runDraftLeague(seed: number, difficulty: DifficultyId): RunResult {
  const cfg = getDifficulty(difficulty);
  const rng = new Rng(`${seed}-budget`);
  const teams = [
    { id: YOU, name: 'YOU', budget: Math.round(CLASSIC_DRAFT_BUDGET * cfg.startBankrollMult) },
  ];
  const aiBase = AI_DRAFT_BUDGET / cfg.startBankrollMult; // weaker rivals on Easy, richer on Hardcore
  for (let i = 0; i < LEAGUE_TEAMS - 1; i++) {
    teams.push({ id: `ai${i}`, name: `Club ${i}`, budget: Math.round(aiBase * (AI_BUDGET_LO + rng.next() * (AI_BUDGET_HI - AI_BUDGET_LO))) });
  }
  // Run the whole draft with the AI drafter for every team (a competent player).
  let d = generateDraft(seed, teams, draftablePool());
  let guard = 0;
  while (!draftComplete(d) && guard++ < 5000) {
    const pick = aiPick(d, currentTeam(d)!);
    if (!pick) break;
    d = applyPick(d, pick);
  }
  const completed = draftComplete(d);
  const league = leagueFromDraft(d);
  const strengths = d.teams.map((_, i) => draftedStrength(d, i));
  const avgStr = strengths.reduce((a, b) => a + b, 0) / LEAGUE_TEAMS;

  // Simulate the season: your fixtures with the real engine, AI-vs-AI light-sim.
  const xi = bestXI(d.teams[0].roster.map((id) => byId.get(id)!).filter(Boolean));
  const chem = computeChemistry(xi);
  const me: MatchTeam = { name: 'YOU', attack: Math.round(chem.totalAttack), defense: Math.round(chem.totalDefense), squad: xi };
  const results: Record<string, LeagueResult> = {};
  const weeks = totalWeeks(league);
  for (let mw = 1; mw <= weeks; mw++) {
    const pf = playerFixture(league, mw);
    if (pf) {
      const oppId = pf.home === YOU ? pf.away : pf.home;
      const club = league.clubs.find((c) => c.id === oppId)!;
      const half = Math.round(club.strength / 2);
      const opp = generateOpponent(half, half, `${seed}-L${mw}-${oppId}`);
      const res = simulateMatch(me, opp, `M-${seed}-${mw}`);
      results[fixtureKey(pf)] = pf.home === YOU
        ? { home: res.score.a, away: res.score.b }
        : { home: res.score.b, away: res.score.a };
    }
    Object.assign(results, simAiWeek({ ...league, results }, mw, seed));
  }
  const finalLeague = { ...league, results, matchweek: weeks + 1 };
  return { pos: position(finalLeague, YOU), yourStr: strengths[0], avgStr, completed };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)]);
};

describe('Classic Draft League — balance', () => {
  it('reports the win-rate + strength curve across difficulties', () => {
    const N = 120;
    const lines = ['\n=== CLASSIC DRAFT LEAGUE: ' + N + ' seasons / difficulty ===',
      'diff       budget  champ%  top3%  avgPos  medYourStr  medLeagueStr  stranded'];
    let allCompleted = true;
    for (const diff of ['easy', 'standard', 'hardcore'] as DifficultyId[]) {
      const budget = Math.round(CLASSIC_DRAFT_BUDGET * getDifficulty(diff).startBankrollMult);
      const runs = Array.from({ length: N }, (_, i) => runDraftLeague((i * 2654435761) >>> 0, diff));
      const champ = runs.filter((r) => r.pos === 1).length;
      const top3 = runs.filter((r) => r.pos <= 3).length;
      const avgPos = runs.reduce((s, r) => s + r.pos, 0) / N;
      const stranded = runs.filter((r) => !r.completed).length;
      if (stranded) allCompleted = false;
      lines.push(
        `${diff.padEnd(9)}  £${String(budget).padStart(4)}M  ` +
        `${((100 * champ) / N).toFixed(0).padStart(5)}%  ${((100 * top3) / N).toFixed(0).padStart(4)}%  ` +
        `${avgPos.toFixed(1).padStart(5)}  ${String(median(runs.map((r) => r.yourStr))).padStart(9)}  ` +
        `${String(median(runs.map((r) => r.avgStr))).padStart(11)}  ${String(stranded).padStart(7)}`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    // INVARIANT: the draft must never strand a team (always a completable XI).
    expect(allCompleted).toBe(true);
    expect(N).toBeGreaterThan(0);
  });
});
