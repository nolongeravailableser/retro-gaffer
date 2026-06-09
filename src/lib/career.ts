/**
 * Career / Dynasty — the meta-layer above a run. A career is a sequence of
 * seasons (each a 12-round climb) where the squad, bankroll and relics persist.
 * Between seasons the board judges you, the academy produces youth, and your
 * players age. Pure & UI-agnostic; the store drives the lifecycle.
 */

import { Rng } from './rng';
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
  /** Division (round) the board demands you reach this season. */
  targetRound: number;
  /** Per-owned-player aging bookkeeping. */
  meta: Record<string, CareerMeta>;
  /** Career roster snapshots (youth + aged players) for the pool overlay. */
  roster: Record<string, Player>;
}

/** Data shown on the between-seasons review screen. */
export interface ReviewState {
  season: number;
  targetRound: number;
  reached: number;
  triumph: boolean; // won the whole climb
  bonus: number; // retention bonus £m
  /** Academy prospects on offer this window. */
  youth: Player[];
}

/** Career-best record, persisted across careers. */
export const CAREER_BONUS = 12; // £m board reward for meeting expectations
export const TRIUMPH_BONUS = 25; // £m for winning the whole season

// Aging tuning.
const PEAK_UNTIL = 2; // veterans hold their level for this many seasons
const DECLINE_STEP = 4; // stat drop per season past the peak
const GROWTH_STEP = 5; // stat gain per growth season (youth)
const YOUTH_GROWTH_SEASONS = 3;
const MIN_STAT = 10;
const MAX_STAT = 99;

/** The board's demand escalates each season, capped at the title. */
export function boardTarget(season: number): number {
  return Math.min(12, 4 + season * 2); // S1:6 S2:8 S3:10 S4+:12
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
    const primary = rng.int(48, 64); // their stronger side
    const secondary = rng.int(30, 50);
    const attackLed = role === 'FWD' || role === 'MID';
    const attack = attackLed ? primary : secondary;
    const defense = attackLed ? secondary : primary;
    const potential = primary + GROWTH_STEP * YOUTH_GROWTH_SEASONS;
    out.push({
      id: `youth-${seed}-${i}`,
      name: `${first} ${last}`,
      cost: 0,
      stats: { attack: clamp(attack), defense: clamp(defense) },
      tags: ['academy'],
      role,
      rarity: potential >= 80 ? 'gold' : 'silver',
      position: undefined,
      synergyTags: ['academy'],
      era: 'Academy',
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
      attack += GROWTH_STEP;
      defense += GROWTH_STEP;
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
