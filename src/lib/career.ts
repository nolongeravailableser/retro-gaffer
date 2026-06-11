/**
 * Career / Dynasty — the meta-layer above a run. A career is a sequence of
 * seasons (each a 12-round climb) where the squad, bankroll and relics persist.
 * Between seasons the board judges you, the academy produces youth, and your
 * players age. Pure & UI-agnostic; the store drives the lifecycle.
 */

import { Rng } from './rng';
import type { SeasonOutcome } from './league';
import type { Facilities } from './stadium';
import type { Player, Role } from './types';

/** Per-player career bookkeeping that aging reads/writes. */
export interface CareerMeta {
  /** Seasons spent at the club (drives decline once past the peak). */
  age: number;
  /** Seasons of growth remaining (youth ramp up before plateauing). */
  growthLeft: number;
}

export interface CareerState {
  /** 1-based season number. */
  season: number;
  /** Division tier the club currently competes in (1 = top, BOTTOM_TIER = base). */
  tier: number;
  /** Per-owned-player aging bookkeeping. */
  meta: Record<string, CareerMeta>;
  /** Career roster snapshots (youth + aged players) for the pool overlay. */
  roster: Record<string, Player>;
  /** Club facility levels (stadium / academy / medical), carried across seasons. */
  facilities: Facilities;
}

/**
 * Data shown on the between-seasons review screen — now a promotion/relegation
 * summary plus the academy intake (aging/youth are unchanged from before).
 */
export interface ReviewState {
  season: number;
  /** Where the club finished this season's league. */
  finishPos: number;
  clubs: number;
  /** Tier just played and the tier next season (promotion/relegation applied). */
  fromTier: number;
  toTier: number;
  /** The season's verdict (never 'champion'/'sacked' — those end the run). */
  outcome: SeasonOutcome;
  bonus: number; // end-of-season reward £m
  /** Academy prospects on offer this window. */
  youth: Player[];
  /** Youth ids whose exact potential has been scouted (revealed). */
  scouted: string[];
}

/** Cost to fully scout a prospect's potential. */
export const SCOUT_YOUTH_COST = 4;

/** End-of-season board rewards (£m) by outcome. */
export const PROMOTION_BONUS = 30; // promoted to a higher division
export const SURVIVAL_BONUS = 12; // held station
export const RELEGATION_BONUS = 6; // dropped but survived the sack

export function reviewBonus(outcome: SeasonOutcome): number {
  if (outcome === 'promoted' || outcome === 'champion') return PROMOTION_BONUS;
  if (outcome === 'relegated') return RELEGATION_BONUS;
  return SURVIVAL_BONUS; // stay
}

/** Academy prospects offered each between-seasons window. */
export const YOUTH_INTAKE = 2;

// Aging tuning.
const PEAK_UNTIL = 2; // veterans hold their level for this many seasons
const DECLINE_STEP = 4; // stat drop per season past the peak
const GROWTH_STEP = 5; // stat gain per growth season (youth)
const YOUTH_GROWTH_SEASONS = 3;
const MIN_STAT = 10;
const MAX_STAT = 99;

/** A 1–5 potential rating from a ceiling stat value. */
export function potentialStars(potential: number): number {
  return Math.max(1, Math.min(5, Math.round((potential - 45) / 11)));
}

const clamp = (v: number) => Math.max(MIN_STAT, Math.min(MAX_STAT, Math.round(v)));

const YOUTH_FIRST = [
  'Kai', 'Reo', 'Jude', 'Cole', 'Rio', 'Tyler', 'Mason', 'Bukayo', 'Jamal',
  'Florian', 'Eduardo', 'Mathys', 'Lamine', 'Arda', 'Warren', 'Kobbie',
];
const YOUTH_LAST = [
  'Ashford', 'Mainoo', 'Garnacho', 'Wharton', 'Nwaneri', 'Bellingham',
  'Yoro', 'Zaire', 'Endrick', 'Cherki', 'Camavinga', 'Musiala', 'Bynoe',
  'Quansah', 'Scarlett', 'Devine',
];

const ALL_ROLES: Role[] = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * Generate `n` academy prospects for a given seed. Each is a free (cost 0) youth
 * with current stats below their ceiling — they grow over their first seasons.
 * Deterministic per seed.
 */
export function generateYouth(seed: string | number, n: number): Player[] {
  const rng = new Rng(seed);
  const out: Player[] = [];
  for (let i = 0; i < n; i++) {
    const role = ALL_ROLES[rng.int(0, ALL_ROLES.length - 1)];
    const first = YOUTH_FIRST[rng.int(0, YOUTH_FIRST.length - 1)];
    const last = YOUTH_LAST[rng.int(0, YOUTH_LAST.length - 1)];
    // Current ability is raw; potential = current + full growth ramp.
    const primary = rng.int(44, 60); // their stronger side, raw
    const secondary = rng.int(28, 46);
    const attackLed = role === 'FWD' || role === 'MID';
    const attack = attackLed ? primary : secondary;
    const defense = attackLed ? secondary : primary;
    // Hidden ceiling with real variance — the thing scouting reveals.
    const potential = clamp(primary + rng.int(10, 34));
    out.push({
      id: `youth-${seed}-${i}`,
      name: `${first} ${last}`,
      cost: 0,
      stats: { attack: clamp(attack), defense: clamp(defense) },
      tags: ['academy'],
      role,
      rarity: potential >= 82 ? 'gold' : 'silver',
      position: undefined,
      synergyTags: ['academy'],
      era: 'Academy',
      potential,
    });
  }
  return out;
}

/** Fresh meta for a newly acquired player (signed at their peak). */
export function newMeta(): CareerMeta {
  return { age: 0, growthLeft: 0 };
}

/** Meta for an academy youth (ramps up before plateauing). */
export function youthMeta(): CareerMeta {
  return { age: 0, growthLeft: YOUTH_GROWTH_SEASONS };
}

/**
 * Advance every owned player one season: youth grow, veterans decline past their
 * peak. Returns the next meta + roster snapshots to register in the overlay.
 * Pure — `resolveBase` returns the player's CURRENT data (overlay or pool).
 */
export function ageRoster(
  ownedIds: readonly string[],
  meta: Record<string, CareerMeta>,
  resolveBase: (id: string) => Player | undefined
): { meta: Record<string, CareerMeta>; roster: Record<string, Player> } {
  const nextMeta: Record<string, CareerMeta> = {};
  const roster: Record<string, Player> = {};

  for (const id of ownedIds) {
    const cur = resolveBase(id);
    if (!cur) continue;
    const m = meta[id] ?? newMeta();
    let { age, growthLeft } = m;
    let { attack, defense } = cur.stats;

    if (growthLeft > 0) {
      // Youth ramp toward their hidden potential (stronger side leads).
      const primary = Math.max(attack, defense);
      const ceiling = cur.potential ?? primary + GROWTH_STEP;
      const gain = Math.max(1, Math.round((ceiling - primary) / growthLeft));
      if (attack >= defense) {
        attack += gain;
        defense += Math.round(gain * 0.6);
      } else {
        defense += gain;
        attack += Math.round(gain * 0.6);
      }
      growthLeft -= 1;
    } else {
      age += 1;
      if (age > PEAK_UNTIL) {
        attack -= DECLINE_STEP;
        defense -= DECLINE_STEP;
      }
    }

    nextMeta[id] = { age, growthLeft };
    roster[id] = { ...cur, stats: { attack: clamp(attack), defense: clamp(defense) } };
  }

  return { meta: nextMeta, roster };
}
