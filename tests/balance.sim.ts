/**
 * Balance harness (not a unit test — a Monte-Carlo simulation).
 *
 * Plays thousands of full runs against the real game logic with a competent,
 * chemistry-aware drafting AI, then reports the difficulty curve and economy
 * health. Run just this file:  npx vitest run tests/balance.test.ts
 *
 * It SKIPS events/relics so we measure the BASE balance (boons only make it
 * easier). Assertions are loose sanity checks; the value is the printed report.
 */

import { describe, it, expect } from 'vitest';
import { POOL } from '@/data/pool';
import { computeChemistry } from '@/lib/chemistry';
import { simulateMatch, type MatchTeam } from '@/lib/engine';
import {
  buildRoundOpponent,
  interest,
  streakBonus,
  lifeBuybackCost,
  MAX_ROUNDS,
  STARTING_LIVES,
  ROUND_INCOME,
} from '@/lib/ladder';
import { wageBill, divisionMult } from '@/lib/wages';
import { getBoss } from '@/lib/bosses';
import { drawShop, MATCH_REWARD, sellValue, STARTING_BANKROLL } from '@/lib/economy';
import { Rng } from '@/lib/rng';
import type { Player, Role } from '@/lib/types';

const NEED: Record<Role, number> = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
const byId = new Map(POOL.map((p) => [p.id, p]));
const value = (p: Player) => p.stats.attack + p.stats.defense;

interface Run {
  bankroll: number;
  lives: number;
  streak: number;
  shield: boolean;
  lifeBuybacks: number;
  xi: string[]; // owned starters (sim ignores bench)
  seed: number;
}

/** Best XI strength via the real chemistry engine. */
function strength(xi: string[]) {
  const starters = xi.map((id) => byId.get(id)!);
  const chem = computeChemistry(starters);
  return {
    starters,
    attack: Math.round(chem.totalAttack),
    defense: Math.round(chem.totalDefense),
  };
}

/** How many of a role the XI already has. */
function roleCount(xi: string[], role: Role) {
  return xi.filter((id) => byId.get(id)!.role === role).length;
}

/** Chem-aware score: shares a tag with the current squad? worth more. */
function fitScore(p: Player, xi: string[]) {
  const tags = new Set(xi.flatMap((id) => byId.get(id)!.synergyTags ?? []));
  const overlap = (p.synergyTags ?? []).filter((t) => tags.has(t)).length;
  return value(p) + overlap * 12;
}

/** A competent draft: fill the XI, then upgrade weakest slots; keep a reserve. */
function draft(run: Run, roundSeed: number) {
  let shopSeed = (run.seed ^ roundSeed ^ 0x9e3779b9) >>> 0;
  const reserve = run.xi.length >= 11 ? 16 : 0; // bank toward interest once set
  let refreshes = 0;

  const rollShop = () => {
    const r = new Rng(shopSeed);
    const ids = drawShop(POOL, new Set(run.xi), r, 3);
    shopSeed = r.int(1, 0x7fffffff);
    return ids.map((id) => byId.get(id)!);
  };

  let shop = rollShop();
  for (let step = 0; step < 30; step++) {
    // Best affordable acquisition: fill an empty role slot, or upgrade.
    let best: { p: Player; gain: number; sellId?: string } | null = null;
    for (const p of shop) {
      if (run.xi.includes(p.id)) continue;
      const have = roleCount(run.xi, p.role);
      if (have < NEED[p.role]) {
        if (p.cost <= run.bankroll - reserve) {
          const gain = fitScore(p, run.xi) + 200; // filling a slot is high value
          if (!best || gain > best.gain) best = { p, gain };
        }
      } else {
        // upgrade: replace the weakest same-role starter if better
        const sameRole = run.xi
          .map((id) => byId.get(id)!)
          .filter((q) => q.role === p.role)
          .sort((a, b) => value(a) - value(b));
        const weakest = sameRole[0];
        if (weakest && fitScore(p, run.xi) > value(weakest) + 4) {
          const net = p.cost - sellValue(weakest);
          if (net <= run.bankroll - reserve) {
            const gain = fitScore(p, run.xi) - value(weakest);
            if (!best || gain > best.gain) best = { p, gain, sellId: weakest.id };
          }
        }
      }
    }

    if (best) {
      if (best.sellId) {
        run.bankroll += sellValue(byId.get(best.sellId)!);
        run.xi = run.xi.filter((id) => id !== best!.sellId);
      }
      run.bankroll -= best.p.cost;
      run.xi.push(best.p.id);
      shop = shop.filter((q) => q.id !== best!.p.id);
      continue;
    }

    // No useful buy — maybe pay to refresh (only while building or rich).
    const wantMore = run.xi.length < 11 || run.bankroll > reserve + 8;
    if (refreshes < 3 && wantMore && run.bankroll - 1 >= reserve) {
      run.bankroll -= 1;
      refreshes++;
      shop = rollShop();
      continue;
    }
    break;
  }
}

function simulateRun(seed: number) {
  const run: Run = {
    bankroll: STARTING_BANKROLL,
    lives: STARTING_LIVES,
    streak: 0,
    shield: false,
    lifeBuybacks: 0,
    xi: [],
    seed,
  };
  const perRound: { outcome: string; round: number }[] = [];
  let round = 1;

  while (round <= MAX_ROUNDS) {
    draft(run, (round * 2246822519) >>> 0);
    const { starters, attack, defense } = strength(run.xi);
    if (starters.length === 0) {
      // never happens after R1 draft, but guard
      run.lives = 0;
      break;
    }
    const me: MatchTeam = { name: 'P', attack, defense, squad: starters };
    const opp = buildRoundOpponent(attack, defense, round, seed);
    const result = simulateMatch(me, opp, `M-${seed}-${round}`);
    const boss = getBoss(round);
    let outcome = result.outcome;
    if (boss?.suddenDeath && outcome === 'draw') outcome = 'loss';

    // economy — division-scaled rewards + rating-based wages (Phase 4.2)
    const newStreak = outcome === 'win' ? run.streak + 1 : 0;
    const dm = divisionMult(round, MAX_ROUNDS);
    const reward = Math.round(MATCH_REWARD[outcome] * dm);
    const wage = Math.round(wageBill(run.xi.map((id) => byId.get(id)!)));
    const payout =
      reward + Math.round(ROUND_INCOME * dm) + interest(run.bankroll) +
      (outcome === 'win' ? streakBonus(newStreak) : 0) - wage;
    run.bankroll = Math.max(0, run.bankroll + payout);
    run.streak = newStreak;

    // survival: shield + boss life cost
    const cleanSheet = outcome === 'win' && result.score.b === 0;
    let lifeCost = outcome === 'loss' ? boss?.lifeCost ?? 1 : 0;
    if (outcome === 'loss' && run.shield) { lifeCost = 0; run.shield = false; }
    else if (cleanSheet) run.shield = true;
    run.lives -= lifeCost;

    // smart buy-back if affordable
    if (run.lives < STARTING_LIVES && run.lives > 0) {
      const cost = lifeBuybackCost(run.lifeBuybacks);
      if (run.bankroll >= cost + 12) { run.bankroll -= cost; run.lives++; run.lifeBuybacks++; }
    }

    perRound.push({ outcome, round });
    if (run.lives <= 0) break;
    round++;
  }

  const reached = Math.min(round, MAX_ROUNDS);
  const last = perRound[perRound.length - 1];
  const won = run.lives > 0 && reached >= MAX_ROUNDS && last?.outcome === 'win';
  return { reached, won, perRound, finalBank: run.bankroll };
}

describe('balance simulation', () => {
  it('reports the difficulty curve and economy', () => {
    const N = 2000;
    const reachedHist = new Array(MAX_ROUNDS + 1).fill(0);
    const winByRound = new Array(MAX_ROUNDS + 1).fill(0);
    const drawByRound = new Array(MAX_ROUNDS + 1).fill(0);
    const lossByRound = new Array(MAX_ROUNDS + 1).fill(0);
    const playedByRound = new Array(MAX_ROUNDS + 1).fill(0);
    let wins = 0;
    let totalReached = 0;

    for (let s = 0; s < N; s++) {
      const r = simulateRun(s * 2654435761);
      reachedHist[r.reached]++;
      totalReached += r.reached;
      if (r.won) wins++;
      for (const e of r.perRound) {
        playedByRound[e.round]++;
        if (e.outcome === 'win') winByRound[e.round]++;
        else if (e.outcome === 'draw') drawByRound[e.round]++;
        else lossByRound[e.round]++;
      }
    }

    const pct = (n: number) => ((100 * n) / N).toFixed(1);
    const lines: string[] = [];
    lines.push(`\n=== BALANCE: ${N} runs ===`);
    lines.push(`Run completion (won the season): ${pct(wins)}%`);
    lines.push(`Avg furthest round: ${(totalReached / N).toFixed(2)} / ${MAX_ROUNDS}`);
    lines.push(`\nRound | played |  win% | draw% | loss% | died here`);
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      const played = playedByRound[r] || 1;
      const boss = getBoss(r) ? ' BOSS' : '';
      lines.push(
        `R${String(r).padStart(2)}${boss.padEnd(5)} | ${String(playedByRound[r]).padStart(5)} | ` +
          `${((100 * winByRound[r]) / played).toFixed(0).padStart(4)}% | ` +
          `${((100 * drawByRound[r]) / played).toFixed(0).padStart(4)}% | ` +
          `${((100 * lossByRound[r]) / played).toFixed(0).padStart(4)}% | ` +
          `${String(lossByRound[r]).padStart(5)}`
      );
    }
    lines.push(`\nFurthest-round histogram:`);
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      lines.push(`  R${String(r).padStart(2)}: ${'#'.repeat(Math.round((50 * reachedHist[r]) / N))} ${pct(reachedHist[r])}%`);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    expect(wins).toBeGreaterThanOrEqual(0);
    expect(totalReached / N).toBeGreaterThan(1);
  });
});
