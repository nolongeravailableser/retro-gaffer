/**
 * Career balance harness (Monte-Carlo, not a unit test). Run: `npm run sim`.
 *
 * Plays many full Career dynasties against the REAL logic — the match engine,
 * the league (fixtures + AI results + table), the FM economy (tier-scaled
 * rewards + rating wages), club facilities, aging, and the promotion/relegation
 * pyramid — with a competent squad-building + reinvestment AI. Reports the
 * climb's shape and the economy's health so `tierMult`/facility income can be
 * tuned against data rather than guesswork.
 *
 * The key questions: is the pyramid climbable but not trivial at each tier? Is
 * the Premier League reachable in a sane number of seasons and hard to win? And
 * does bankroll stay bounded at the top with a maxed stadium (no runaway)?
 */

import { describe, it, expect } from 'vitest';
import { POOL } from '@/data/pool';
import { computeChemistry } from '@/lib/chemistry';
import { simulateMatch, type MatchTeam } from '@/lib/engine';
import { generateOpponent } from '@/lib/opponent';
import { interest, streakBonus, ROUND_INCOME } from '@/lib/ladder';
import { wageBill, tierMult, WAGE_TIER_K, wageBudget } from '@/lib/wages';
import { boardConfidence } from '@/lib/board';
import { DIFFICULTIES, getDifficulty, canSack, wageCap, type DifficultyConfig } from '@/lib/difficulty';
import { matchdayIncomeFor, upgradeCost, isMaxed, UPKEEP_PER_LEVEL, type FacilityId } from '@/lib/stadium';
import { ageRoster, newMeta, reviewBonus, DEFAULT_CONTRACT, type CareerMeta } from '@/lib/career';
import {
  generateLeague, simAiWeek, position, seasonOutcome, nextTier,
  division, totalWeeks, seasonScale, playerFixture, fixtureKey, BOTTOM_TIER, TOP_TIER, YOU,
  type LeagueState, type LeagueResult,
} from '@/lib/league';
import { drawShop, MATCH_REWARD } from '@/lib/economy';
import { transferFee, marketSellValue, renewalCost, CAREER_STARTING_BANKROLL } from '@/lib/market';
import { seasonSponsorship, disciplinaryFine } from '@/lib/finance';
import { Rng } from '@/lib/rng';
import type { Player, Role } from '@/lib/types';

const NEED: Record<Role, number> = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
const byId = new Map(POOL.map((p) => [p.id, p]));
const LEAGUE_TEAMS = 12;
const SEASON_CAP = 20; // a long dynasty; most careers end (sacked/champion) sooner
const RESERVE = 12; // keep some cash for upkeep/facilities

interface Career {
  bankroll: number;
  owned: string[];
  roster: Map<string, Player>; // current (possibly aged) stats by id
  meta: Record<string, CareerMeta>;
  facilities: Record<FacilityId, number>;
  tier: number;
  season: number;
  streak: number;
  seed: number;
  diff: DifficultyConfig;
  /** This season's player record, for board-confidence sacking (Hardcore). */
  record: { w: number; d: number; l: number };
}

const cur = (c: Career, id: string): Player => c.roster.get(id) ?? byId.get(id)!;
const value = (c: Career, id: string) => { const p = cur(c, id); return p.stats.attack + p.stats.defense; };

function strength(c: Career) {
  const starters = c.owned.map((id) => cur(c, id));
  const chem = computeChemistry(starters);
  return { starters, attack: Math.round(chem.totalAttack), defense: Math.round(chem.totalDefense) };
}

function roleCount(c: Career, role: Role) {
  return c.owned.filter((id) => cur(c, id).role === role).length;
}

function fitScore(c: Career, p: Player) {
  const tags = new Set(c.owned.flatMap((id) => cur(c, id).synergyTags ?? []));
  const overlap = (p.synergyTags ?? []).filter((t) => tags.has(t)).length;
  return p.stats.attack + p.stats.defense + overlap * 12;
}

/** Spend toward a stronger XI: fill empty slots, upgrade weak ones, keep a reserve. */
function draft(c: Career) {
  let shopSeed = (c.seed ^ (c.season * 2246822519) ^ 0x9e3779b9) >>> 0;
  let refreshes = 0;
  const rollShop = () => {
    const r = new Rng(shopSeed);
    const ids = drawShop(POOL, new Set(c.owned), r, 3);
    shopSeed = r.int(1, 0x7fffffff);
    return ids.map((id) => byId.get(id)!);
  };
  let shop = rollShop();
  for (let step = 0; step < 60; step++) {
    // Spend freely while still assembling a legal XI; only hold a reserve once
    // the team is complete (mirrors the shipped balance.sim's drafting AI).
    const reserve = c.owned.length >= 11 ? RESERVE : 0;
    // Budget pacing while building: don't blow the bank on one slot — leave
    // enough to fill the remaining XI slots (a real manager buys an affordable
    // XI first, then upgrades). Generous slack so a star can still be the centrepiece.
    const slotsLeft = Math.max(1, 11 - c.owned.length);
    const perSlot = c.owned.length >= 11 ? Infinity : ((c.bankroll - reserve) / slotsLeft) * 1.15;
    let best: { p: Player; gain: number; sellId?: string } | null = null;
    for (const p of shop) {
      if (c.owned.includes(p.id)) continue;
      const have = roleCount(c, p.role);
      const price = transferFee(p, c.tier); // free agents (sub-64 overall) cost nothing
      if (have < NEED[p.role]) {
        if (price <= c.bankroll - reserve && price <= perSlot) {
          const gain = fitScore(c, p) + 200;
          if (!best || gain > best.gain) best = { p, gain };
        }
      } else if (c.owned.length >= 11) {
        // Only upgrade once a legal XI is complete — never spend on upgrades
        // while roles are still unfilled (that's how a budget gets blown).
        const sameRole = c.owned.map((id) => cur(c, id)).filter((q) => q.role === p.role)
          .sort((a, b) => (a.stats.attack + a.stats.defense) - (b.stats.attack + b.stats.defense));
        const weakest = sameRole[0];
        if (weakest && fitScore(c, p) > value(c, weakest.id) + 6) {
          const net = price - marketSellValue(cur(c, weakest.id), c.tier);
          // Hard wage ceiling (the difficulty budget lever): an upgrade that would
          // push the wage bill over the cap is refused — galáctico-stacking is
          // gated tighter on Hardcore, looser on Easy. Mirrors store.signPlayer.
          const cap = wageCap(wageBudget(c.bankroll - net, tierMult(c.tier)), c.diff);
          const newBill = wageBill(
            c.owned.filter((id) => id !== weakest.id).map((id) => cur(c, id)).concat(p)
          );
          if (net <= c.bankroll - reserve && newBill <= cap) {
            const gain = fitScore(c, p) - value(c, weakest.id);
            if (!best || gain > best.gain) best = { p, gain, sellId: weakest.id };
          }
        }
      }
    }
    if (best) {
      if (best.sellId) {
        c.bankroll += marketSellValue(cur(c, best.sellId), c.tier);
        c.owned = c.owned.filter((id) => id !== best!.sellId);
        c.roster.delete(best.sellId);
        delete c.meta[best.sellId];
      }
      c.bankroll -= transferFee(best.p, c.tier);
      c.owned.push(best.p.id);
      c.roster.set(best.p.id, byId.get(best.p.id)!);
      c.meta[best.p.id] = newMeta();
      shop = shop.filter((q) => q.id !== best!.p.id);
      continue;
    }
    // While still assembling a legal XI, refresh freely (models the free
    // per-round refresh + income across a season's matchweeks). Once complete,
    // refreshing is paid and capped.
    if (c.owned.length < 11) {
      if (step < 59) { shop = rollShop(); continue; }
      break;
    }
    if (refreshes < 3 && c.bankroll > reserve + 12 && c.bankroll - 1 >= reserve) {
      c.bankroll -= 1; refreshes++; shop = rollShop(); continue;
    }
    break;
  }
}

/** Reinvest spare cash into facilities (income first, then medical, then academy). */
function developClub(c: Career) {
  const order: FacilityId[] = ['stadium', 'medical', 'academy'];
  let progress = true;
  while (progress) {
    progress = false;
    for (const id of order) {
      const lvl = c.facilities[id];
      if (isMaxed(lvl)) continue;
      const cost = upgradeCost(id, lvl);
      if (c.bankroll - cost >= RESERVE + 10) {
        c.bankroll -= cost; c.facilities[id] = lvl + 1; progress = true;
      }
    }
  }
}

/**
 * Candidate wage multiplier by tier under test. K=1 reproduces today's economy
 * (flat wages); K>1 makes each higher division demand steeper wages
 * (wage ×= K^(stepsUpFromBottom)). Set per sweep below.
 */
let WAGE_K = 1;
const wageTierMult = (tier: number) => WAGE_K ** (BOTTOM_TIER - tier);

/** Tunable facility running-cost per level under test (£m/matchweek, pre-tier). */
let UPKEEP_LEVEL = 0;
const upkeepFor = (c: Career) =>
  Math.round((c.facilities.stadium + c.facilities.academy + c.facilities.medical) * UPKEEP_LEVEL * tierMult(c.tier));

/** Play one matchweek (player fixture via the real engine), update the economy. */
function playMatchweek(c: Career, league: LeagueState, mw: number, results: Record<string, LeagueResult>) {
  const pf = playerFixture(league, mw);
  const { starters, attack, defense } = strength(c);
  const me: MatchTeam = { name: 'YOU', attack, defense, squad: starters };

  if (pf) {
    const oppId = pf.home === YOU ? pf.away : pf.home;
    const club = league.clubs.find((cl) => cl.id === oppId)!;
    const half = Math.round(club.strength / 2);
    const opp = generateOpponent(half, half, `${c.seed}-L${mw}-${oppId}`);
    const result = simulateMatch(me, opp, `M-${c.seed}-${c.season}-${mw}`);
    results[fixtureKey(pf)] = pf.home === YOU
      ? { home: result.score.a, away: result.score.b }
      : { home: result.score.b, away: result.score.a };

    // Economy — mirrors resolveLeagueRound exactly (incl. the season-length scale).
    const outcome = result.outcome;
    c.streak = outcome === 'win' ? c.streak + 1 : 0;
    if (outcome === 'win') c.record.w++;
    else if (outcome === 'draw') c.record.d++;
    else c.record.l++;
    const scale = seasonScale(league);
    const dm = tierMult(c.tier);
    const reward = Math.round(MATCH_REWARD[outcome] * dm * scale);
    const income = Math.round((ROUND_INCOME * dm + matchdayIncomeFor(c.facilities.stadium, c.streak)) * scale);
    const intr = Math.round(interest(c.bankroll) * scale);
    const sb = outcome === 'win' ? Math.round(streakBonus(c.streak) * scale) : 0;
    const wage = Math.round(wageBill(c.owned.map((id) => cur(c, id))) * wageTierMult(c.tier) * scale);
    const upkeep = Math.round(upkeepFor(c) * scale);
    // Disciplinary fines — count side-A bookings from the real match events,
    // scaled by division (mirrors resolveLeagueRound). The discipline tax that
    // counterweights sponsorship.
    let yellows = 0, reds = 0;
    for (const e of result.events) {
      if (e.side !== 'A') continue;
      if (e.kind === 'yellow') yellows++;
      else if (e.kind === 'red') reds++;
    }
    const fine = Math.round(disciplinaryFine(yellows, reds, c.tier) * scale);
    c.bankroll = Math.max(0, c.bankroll + reward + income + intr + sb - wage - upkeep - fine);
  }
  Object.assign(results, simAiWeek(league, mw, c.seed));
}

interface CareerResult {
  outcome: 'champion' | 'sacked' | 'ongoing';
  seasons: number;
  highestTier: number;
  reachedPL: boolean;
  seasonsToPL: number | null;
  bankrollByTier: Record<number, number[]>; // end-of-season bankroll samples per tier
  maxBankroll: number;
  finalFacilities: Record<FacilityId, number>;
  promoBy: Record<number, { played: number; promoted: number; relegated: number }>;
}

function simulateCareer(seed: number, diff: DifficultyConfig = DIFFICULTIES.standard): CareerResult {
  const c: Career = {
    bankroll: Math.round(CAREER_STARTING_BANKROLL * diff.startBankrollMult),
    owned: [], roster: new Map(), meta: {},
    facilities: { stadium: 0, academy: 0, medical: 0 },
    tier: BOTTOM_TIER, season: 1, streak: 0, seed, diff,
    record: { w: 0, d: 0, l: 0 },
  };
  const bankrollByTier: CareerResult['bankrollByTier'] = {};
  const promoBy: CareerResult['promoBy'] = {};
  let maxBankroll = CAREER_STARTING_BANKROLL;
  let highestTier = BOTTOM_TIER;
  let seasonsToPL: number | null = null;

  for (; c.season <= SEASON_CAP; c.season++) {
    // Season sponsorship is banked up front (mirrors startCareer /
    // advanceCareerSeason) — part of the budget you draft + develop against.
    c.bankroll += seasonSponsorship(c.tier);
    c.record = { w: 0, d: 0, l: 0 };
    draft(c);
    developClub(c);
    if (c.owned.length < 11) { return finish('sacked'); } // couldn't field a side (shouldn't happen)

    // The division base scales with difficulty (Hardcore faces tougher clubs).
    const aiBase = Math.round(division(c.tier).baseStrength * c.diff.aiStrengthMult);
    const league = generateLeague(`${seed}-s${c.season}`, aiBase, LEAGUE_TEAMS);
    const results: Record<string, LeagueResult> = {};
    const weeks = totalWeeks(league);
    for (let mw = 1; mw <= weeks; mw++) {
      playMatchweek(c, { ...league, results }, mw, results);
      maxBankroll = Math.max(maxBankroll, c.bankroll);
    }
    const finalLeague: LeagueState = { ...league, results, matchweek: weeks + 1 };
    const pos = position(finalLeague, YOU);
    let outcome = seasonOutcome(c.tier, pos, LEAGUE_TEAMS);
    // Board teeth (Hardcore): a season of sustained low confidence gets you
    // sacked even without relegation (mirrors resolveLeagueRound).
    const endConf = boardConfidence(pos, LEAGUE_TEAMS, c.record);
    if (outcome !== 'promoted' && outcome !== 'champion' && canSack(c.diff, endConf, c.season)) {
      outcome = 'sacked';
    }

    (bankrollByTier[c.tier] ??= []).push(c.bankroll);
    const pb = (promoBy[c.tier] ??= { played: 0, promoted: 0, relegated: 0 });
    pb.played++;
    if (outcome === 'promoted' || outcome === 'champion') pb.promoted++;
    if (outcome === 'relegated' || outcome === 'sacked') pb.relegated++;
    highestTier = Math.min(highestTier, c.tier);
    if (c.tier === TOP_TIER && seasonsToPL === null) seasonsToPL = c.season;

    if (outcome === 'champion') return finish('champion');
    if (outcome === 'sacked') return finish('sacked');

    // Between seasons: board bonus, age the squad, climb/drop the pyramid.
    c.bankroll += reviewBonus(outcome);
    const aged = ageRoster(c.owned, c.meta, (id) => cur(c, id));
    c.meta = aged.meta;
    for (const [id, p] of Object.entries(aged.roster)) c.roster.set(id, p);

    // Contracts: the standing money sink. Deals run down a season; the manager
    // renews the best expiring players he can afford (signing-on bonuses; free
    // agents re-sign for nothing) and lets the rest lapse on a Bosman — draft()
    // re-fills next season. Mirrors store.advanceCareerSeason + renewContract.
    {
      const renewTier = c.tier; // the division just played
      const expiring = c.owned.filter((id) => (c.meta[id]?.contractYears ?? DEFAULT_CONTRACT) <= 1);
      const ranked = [...expiring].sort((a, b) => value(c, b) - value(c, a)); // keep your best
      const renewed = new Set<string>();
      for (const id of ranked) {
        const cost = renewalCost(cur(c, id), renewTier);
        if (cost === 0) { renewed.add(id); continue; } // free agents re-sign free
        if (c.bankroll - cost >= RESERVE) { c.bankroll -= cost; renewed.add(id); }
      }
      const departed: string[] = [];
      for (const id of c.owned) {
        const m = c.meta[id] ?? newMeta();
        if (renewed.has(id)) { c.meta[id] = { ...m, contractYears: DEFAULT_CONTRACT }; continue; }
        const years = (m.contractYears ?? DEFAULT_CONTRACT) - 1;
        if (years <= 0) departed.push(id);
        else c.meta[id] = { ...m, contractYears: years };
      }
      for (const id of departed) {
        c.owned = c.owned.filter((x) => x !== id);
        c.roster.delete(id);
        delete c.meta[id];
      }
    }

    c.tier = nextTier(c.tier, outcome);
  }
  return finish('ongoing');

  function finish(outcome: CareerResult['outcome']): CareerResult {
    return {
      outcome, seasons: c.season, highestTier,
      reachedPL: highestTier === TOP_TIER, seasonsToPL,
      bankrollByTier, maxBankroll, finalFacilities: { ...c.facilities }, promoBy,
    };
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function runSweep(N: number, k: number, upkeep = 0) {
  WAGE_K = k;
  UPKEEP_LEVEL = upkeep;
  const results = Array.from({ length: N }, (_, i) => simulateCareer((i * 2654435761) >>> 0));
  const champions = results.filter((r) => r.outcome === 'champion').length;
  const sacked = results.filter((r) => r.outcome === 'sacked').length;
  const reachedPL = results.filter((r) => r.reachedPL).length;
  const avgSeasons = results.reduce((s, r) => s + r.seasons, 0) / N;
  const banks: Record<number, number[]> = { 1: [], 2: [], 3: [], 5: [] };
  let promoT2 = 0, playedT2 = 0, promoT1 = 0, playedT1 = 0;
  for (const r of results) {
    for (const t of [1, 2, 3, 5]) if (r.bankrollByTier[t]) banks[t].push(...r.bankrollByTier[t]);
    if (r.promoBy[2]) { playedT2 += r.promoBy[2].played; promoT2 += r.promoBy[2].promoted; }
    if (r.promoBy[1]) { playedT1 += r.promoBy[1].played; promoT1 += r.promoBy[1].promoted; }
  }
  const maxBank = Math.max(...results.map((r) => r.maxBankroll));
  return {
    k, champions, sacked, reachedPL, avgSeasons,
    medT5: median(banks[5]), medT3: median(banks[3]), medT2: median(banks[2]), medT1: median(banks[1]), maxBank,
    promoT2pct: playedT2 ? (100 * promoT2) / playedT2 : 0,
    titlePct: playedT1 ? (100 * promoT1) / playedT1 : 0,
    N,
  };
}

/** Per-difficulty climb + failure profile (the tension report). */
function runDiffSweep(N: number, diff: DifficultyConfig) {
  WAGE_K = WAGE_TIER_K;       // shipped economy …
  UPKEEP_LEVEL = UPKEEP_PER_LEVEL; // … so tension is read against the real money model
  const results = Array.from({ length: N }, (_, i) => simulateCareer((i * 2654435761) >>> 0, diff));
  const champ = results.filter((r) => r.outcome === 'champion').length;
  const sacked = results.filter((r) => r.outcome === 'sacked').length;
  const reachedPL = results.filter((r) => r.reachedPL).length;
  const avgSeasons = results.reduce((s, r) => s + r.seasons, 0) / N;
  // Per-tier promotion% (T1 = title%).
  const promo: Record<number, { played: number; up: number }> = {};
  for (const r of results) for (const t of [5, 4, 3, 2, 1]) {
    if (!r.promoBy[t]) continue;
    (promo[t] ??= { played: 0, up: 0 });
    promo[t].played += r.promoBy[t].played;
    promo[t].up += r.promoBy[t].promoted;
  }
  const pct = (t: number) => (promo[t]?.played ? (100 * promo[t].up) / promo[t].played : 0);
  return {
    champ: (100 * champ) / N, sacked: (100 * sacked) / N, reachedPL: (100 * reachedPL) / N,
    avgSeasons, t5: pct(5), t4: pct(4), t3: pct(3), t2: pct(2), t1: pct(1),
  };
}

describe('career balance — difficulty sweep', () => {
  it('reports the climb + failure profile per difficulty', () => {
    const N = 250;
    const lines = ['\n=== CAREER DIFFICULTY SWEEP (climb + tension) ===',
      'diff       champ%  sack%  PL%   avgS  T5up%  T4up%  T3up%  T2up%  title%'];
    const by: Record<string, ReturnType<typeof runDiffSweep>> = {};
    for (const id of ['easy', 'standard', 'hardcore'] as const) {
      const d = getDifficulty(id);
      const r = runDiffSweep(N, d);
      by[id] = r;
      lines.push(
        `${id.padEnd(9)}  ${r.champ.toFixed(0).padStart(5)}%  ${r.sacked.toFixed(0).padStart(4)}%  ` +
        `${r.reachedPL.toFixed(0).padStart(3)}%  ${r.avgSeasons.toFixed(1).padStart(4)}  ` +
        `${r.t5.toFixed(0).padStart(4)}%  ${r.t4.toFixed(0).padStart(4)}%  ${r.t3.toFixed(0).padStart(4)}%  ` +
        `${r.t2.toFixed(0).padStart(4)}%  ${r.t1.toFixed(0).padStart(5)}%`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    // Guard the tuning: the dial must produce a real tension gradient.
    // Winning gets monotonically harder, sacking monotonically more likely.
    expect(by.easy.champ).toBeGreaterThan(by.standard.champ);
    expect(by.standard.champ).toBeGreaterThan(by.hardcore.champ);
    expect(by.hardcore.sacked).toBeGreaterThan(by.standard.sacked);
    // Standard is a genuine contest (not the old near-guaranteed climb) but still
    // winnable for a dedicated dynasty, and the climb is contested at the top.
    expect(by.standard.champ).toBeGreaterThan(20);
    expect(by.standard.champ).toBeLessThan(55);
    expect(by.standard.t2).toBeLessThan(60); // Championship → PL is hard-won
    // Hardcore is brutal but not hopeless — the PL is still reachable.
    expect(by.hardcore.sacked).toBeGreaterThan(50);
    expect(by.hardcore.reachedPL).toBeGreaterThan(20);
  });
});

describe('career balance — wage-scaling sweep', () => {
  it('compares wage-tier multipliers to bound the economy', () => {
    const N = 250;
    const lines = ['\n=== CAREER WAGE-SCALING SWEEP ===',
      'K     champ%  PL%   sack%  avgS  medT5    medT1     maxBank   promoChamp%  title%'];
    for (const k of [1.0, 1.7, 1.8, 1.9, 2.0]) {
      const r = runSweep(N, k);
      lines.push(
        `${k.toFixed(1)}  ${((100 * r.champions) / r.N).toFixed(0).padStart(5)}%  ` +
        `${((100 * r.reachedPL) / r.N).toFixed(0).padStart(3)}%  ` +
        `${((100 * r.sacked) / r.N).toFixed(0).padStart(4)}%  ` +
        `${r.avgSeasons.toFixed(1).padStart(4)}  £${String(r.medT5).padStart(5)}M  ` +
        `£${String(r.medT1).padStart(7)}M  £${String(r.maxBank).padStart(6)}M  ` +
        `${r.promoT2pct.toFixed(0).padStart(8)}%   ${r.titlePct.toFixed(0).padStart(4)}%`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(N).toBeGreaterThan(0);
  });
});

describe('career balance — facility-upkeep sweep', () => {
  it('compares facility running costs (with shipped wage-scaling) as a money sink', () => {
    const N = 250;
    const lines = ['\n=== CAREER WAGE×UPKEEP COMBO SWEEP (market pricing ON) ===',
      'wageK  upkeep  champ%  sack%  PL%   avgS  medT3    medT2     medT1     maxBank'];
    // Renewals are ON in the sim now (the standing sink), so re-pick wages/upkeep
    // relaxed — renewals carry much of the drain. Bounds the top-tier plateau.
    // Anchored on the SHIPPED (1.4, 0.85) + renewals; neighbours bound the
    // top-tier plateau (renewals are ON in the sim — the standing sink).
    const combos: [number, number][] = [
      [1.3, 0.75], [1.35, 0.82], [1.4, 0.85], [1.5, 1.0],
    ];
    for (const [k, u] of combos) {
      const r = runSweep(N, k, u);
      lines.push(
        `${k.toFixed(1).padStart(4)}  ${u.toFixed(2).padStart(6)}  ${((100 * r.champions) / r.N).toFixed(0).padStart(5)}%  ` +
        `${((100 * r.sacked) / r.N).toFixed(0).padStart(4)}%  ` +
        `${((100 * r.reachedPL) / r.N).toFixed(0).padStart(3)}%  ${r.avgSeasons.toFixed(1).padStart(4)}  ` +
        `£${String(r.medT3 ?? 0).padStart(5)}M  £${String(r.medT2 ?? 0).padStart(6)}M  ` +
        `£${String(r.medT1).padStart(6)}M  £${String(r.maxBank).padStart(6)}M`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(N).toBeGreaterThan(0);
  });
});

describe('career balance simulation', () => {
  it('reports the pyramid climb + economy health', () => {
    WAGE_K = WAGE_TIER_K; // detailed report mirrors the SHIPPED economy …
    UPKEEP_LEVEL = UPKEEP_PER_LEVEL; // … including facility upkeep
    const N = 300;
    const results = Array.from({ length: N }, (_, i) => simulateCareer((i * 2654435761) >>> 0));

    const champions = results.filter((r) => r.outcome === 'champion').length;
    const sacked = results.filter((r) => r.outcome === 'sacked').length;
    const ongoing = results.filter((r) => r.outcome === 'ongoing').length;
    const reachedPL = results.filter((r) => r.reachedPL).length;
    const avgSeasons = results.reduce((s, r) => s + r.seasons, 0) / N;
    const plSeasons = results.filter((r) => r.seasonsToPL !== null).map((r) => r.seasonsToPL!);

    // Aggregate per-tier promotion/relegation + median end-of-season bankroll.
    const tiers = [5, 4, 3, 2, 1];
    const perTier = tiers.map((t) => {
      const banks: number[] = [];
      let played = 0, promoted = 0, relegated = 0;
      for (const r of results) {
        if (r.bankrollByTier[t]) banks.push(...r.bankrollByTier[t]);
        if (r.promoBy[t]) { played += r.promoBy[t].played; promoted += r.promoBy[t].promoted; relegated += r.promoBy[t].relegated; }
      }
      return { t, played, promoted, relegated, medBank: median(banks) };
    });

    const maxBankAll = Math.max(...results.map((r) => r.maxBankroll));
    const hoarders = results.filter((r) => r.maxBankroll > 400).length; // runaway check

    const lines: string[] = [];
    lines.push(`\n=== CAREER BALANCE: ${N} dynasties (cap ${SEASON_CAP} seasons) ===`);
    lines.push(`Champions of England: ${((100 * champions) / N).toFixed(1)}%`);
    lines.push(`Sacked: ${((100 * sacked) / N).toFixed(1)}%  ·  still going at cap: ${((100 * ongoing) / N).toFixed(1)}%`);
    lines.push(`Reached the Premier League: ${((100 * reachedPL) / N).toFixed(1)}%`);
    lines.push(`Avg seasons / career: ${avgSeasons.toFixed(1)}`);
    lines.push(`Avg seasons to reach the PL (of those who did): ${plSeasons.length ? (plSeasons.reduce((a, b) => a + b, 0) / plSeasons.length).toFixed(1) : '—'}`);
    lines.push(`\nTier (division)        | seasons | promo% | releg% | median £ end-of-season`);
    for (const pt of perTier) {
      lines.push(
        `T${pt.t} ${division(pt.t).name.padEnd(16)} | ${String(pt.played).padStart(7)} | ` +
        `${pt.played ? ((100 * pt.promoted) / pt.played).toFixed(0).padStart(5) : '   —'}% | ` +
        `${pt.played ? ((100 * pt.relegated) / pt.played).toFixed(0).padStart(5) : '   —'}% | £${pt.medBank}M`
      );
    }
    lines.push(`\nEconomy: max bankroll seen across all careers £${maxBankAll}M · "hoarders" (>£400M): ${((100 * hoarders) / N).toFixed(1)}%`);
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    expect(N).toBeGreaterThan(0);
    expect(avgSeasons).toBeGreaterThan(1);
  });
});
