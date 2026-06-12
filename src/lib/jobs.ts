/**
 * Manager career — reputation & the job market. A sacking is a setback, never an
 * ending: you apply for other jobs in the football world, and your REPUTATION
 * (earned across every club you've managed) gates which clubs will have you.
 *
 * The persistent identity is the MANAGER, not the club — reputation and the
 * trophy cabinet span your whole career. A brand-new career starts you at your
 * own club from the bottom; getting sacked sends you here to take over an
 * established club instead.
 *
 * Pure & deterministic (seeded), so the vacancy list replays identically.
 */

import { Rng } from './rng';
import { BOTTOM_TIER, TOP_TIER, division } from './league';
import type { CareerHonours } from './career';

/**
 * Manager reputation, 0–100. Built from career achievements: the highest
 * division ever reached (the biggest factor), titles & promotions, and how long
 * you've managed — lightly dented by relegations. A fresh manager sits near 0
 * (only the bottom tier will have them); a Champion of England sits near the top.
 */
export function managerReputation(h: CareerHonours): number {
  // Peak division reached → up to 55. (Empty history ⇒ highestTier is Infinity.)
  const tierScore = Number.isFinite(h.highestTier)
    ? ((BOTTOM_TIER - h.highestTier) / Math.max(1, BOTTOM_TIER - TOP_TIER)) * 55
    : 0;
  const honourScore = Math.min(
    30,
    h.divisionTitles * 8 + h.promotions * 5 + (h.championOfEngland ? 10 : 0) + h.cupTitles * 6
  );
  const tenureScore = Math.min(15, h.seasonsPlayed * 1.5);
  const setback = Math.min(15, h.relegations * 3);
  return Math.max(0, Math.min(100, Math.round(tierScore + honourScore + tenureScore - setback)));
}

/**
 * The highest division a club will hire you into, from your reputation. Every
 * ~20 reputation lifts the ceiling one rung; 0 → only the bottom tier, 80+ → the
 * top flight. You can always be offered jobs from this ceiling DOWN to the base.
 */
export function reputationCeilingTier(reputation: number): number {
  return Math.max(TOP_TIER, Math.min(BOTTOM_TIER, BOTTOM_TIER - Math.floor(reputation / 20)));
}

/** A short, human label for a reputation level (UI flavour). */
export function reputationLabel(reputation: number): string {
  if (reputation >= 80) return 'Elite';
  if (reputation >= 60) return 'Established';
  if (reputation >= 40) return 'Respected';
  if (reputation >= 20) return 'Up-and-coming';
  return 'Unproven';
}

/** A club vacancy you can apply for. */
export interface Vacancy {
  id: string;
  clubName: string;
  /** Division tier the club competes in (1 = top … BOTTOM_TIER = base). */
  tier: number;
  /** Club stature (ATK+DEF) — informs the squad you inherit + the AI field. */
  strength: number;
}

/** Fictional clubs across the football world (distinct from the league pool). */
const WORLD_CLUBS = [
  'Avonmouth Town', 'Belmont Rovers', 'Carrow United', 'Dunmore City',
  'Eastfield Athletic', 'Foxton Wanderers', 'Greendale FC', 'Harlow Borough',
  'Ilkeston Park', 'Jarrow Albion', 'Kelby Town', 'Longwood United',
  'Mossley Rovers', 'Netherton FC', 'Oakvale City', 'Prestwick Athletic',
  'Quayside United', 'Redmarsh Town', 'Stowford Wanderers', 'Tarnby FC',
];

/** How many vacancies a sacked manager is shown to choose from. */
export const VACANCY_COUNT = 4;

/**
 * Generate the jobs available to a manager of the given reputation. Always
 * returns at least one (there's always SOMEONE who'll take a punt → never game
 * over). Clubs span from your reputation ceiling down to the base, biased toward
 * the ceiling (your best realistic move) with humbler fallbacks. Deterministic.
 */
export function generateVacancies(
  reputation: number,
  seed: string | number,
  count = VACANCY_COUNT
): Vacancy[] {
  const rng = new Rng(`${seed}-jobs`);
  const ceiling = reputationCeilingTier(reputation);
  const span = BOTTOM_TIER - ceiling; // tiers between ceiling and base
  const names = [...WORLD_CLUBS];
  const out: Vacancy[] = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    // Bias toward the ceiling (a steeper power keeps most offers near your level).
    const tier = Math.max(ceiling, Math.min(BOTTOM_TIER, ceiling + Math.floor(rng.next() ** 1.6 * (span + 1))));
    const base = division(tier).baseStrength;
    const strength = Math.round(base * (0.85 + rng.next() * 0.3));
    const idx = names.length ? rng.int(0, names.length - 1) : -1;
    const clubName = idx >= 0 ? names.splice(idx, 1)[0] : `Club ${i + 1}`;
    out.push({ id: `job-${i}`, clubName, tier, strength });
  }
  return out;
}

// --- Taking over a club: inherit its real squad ----------------------------

/** Minimal player shape the squad drafter reads (avoids a Player import cycle). */
interface RatedPlayer {
  id: string;
  role: string;
  stats: { attack: number; defense: number };
}

/** Role targets for an inherited squad (14 — a full XI + cover). */
const INHERIT_NEED: Record<string, number> = { GK: 1, DEF: 5, MID: 5, FWD: 3 };

/**
 * Draft the squad you inherit when you take over a club — REAL pool players
 * matched to the club's stature. Each role is filled with players whose rating
 * sits near the club's per-player budget (`strength / squadSize`), so a
 * Championship side hands you Championship-grade players and a non-league side
 * hands you journeymen. Seeded for run-to-run variety; never picks a duplicate.
 * Returns owned player ids. Pure.
 */
export function draftInheritedSquad(
  targetStrength: number,
  pool: readonly RatedPlayer[],
  seed: string | number
): string[] {
  const size = Object.values(INHERIT_NEED).reduce((a, b) => a + b, 0);
  const budget = targetStrength / size; // per-player attack+defense target
  const rng = new Rng(`${seed}-inherit`);
  const squad: string[] = [];
  for (const [role, need] of Object.entries(INHERIT_NEED)) {
    const cands = pool
      .filter((p) => p.role === role)
      .map((p) => ({ id: p.id, r: p.stats.attack + p.stats.defense }))
      .sort((a, b) => Math.abs(a.r - budget) - Math.abs(b.r - budget)); // closest to budget first
    // Sample from the closest ~3× the needed count, so the squad is stature-
    // matched but not identical every run.
    const window = cands.slice(0, Math.min(cands.length, Math.max(need, need * 3)));
    for (let i = window.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [window[i], window[j]] = [window[j], window[i]];
    }
    for (let k = 0; k < need && k < window.length; k++) squad.push(window[k].id);
  }
  return squad;
}
