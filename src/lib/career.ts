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
  /** Seasons left on the player's contract. Hits 0 → leaves on a free (Bosman)
   *  unless renewed in the between-seasons review. */
  contractYears: number;
}

/** Contract length (seasons) a fresh signing is given. */
export const DEFAULT_CONTRACT = 3;
/** Academy graduates sign longer deals. */
export const YOUTH_CONTRACT = 4;

/** Whether a player's deal expires at the end of this season (decide in the review). */
export function isExpiring(meta: CareerMeta | undefined): boolean {
  return (meta?.contractYears ?? DEFAULT_CONTRACT) <= 1;
}

/** One completed season in the club's history (drives the timeline + honours). */
export interface SeasonRecord {
  season: number;
  /** Division tier the season was played in. */
  tier: number;
  finishPos: number;
  clubs: number;
  /** The season's verdict. */
  outcome: SeasonOutcome;
  /** The club managed that season (Manager career spans clubs). Optional — legacy
   *  records predate it. */
  club?: string;
  /** Whether you lifted the domestic Cup that season. Optional — legacy records
   *  (and seasons before the cup shipped) predate it. */
  cupWon?: boolean;
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
  /** Completed-season log, oldest first — the club's story so far. */
  history: SeasonRecord[];
}

/** Honours & lifetime tallies derived from a career's completed-season log. */
export interface CareerHonours {
  /** Seasons finished 1st in their division. */
  divisionTitles: number;
  /** Won the top tier (the ultimate). */
  championOfEngland: boolean;
  promotions: number;
  relegations: number;
  seasonsPlayed: number;
  /** Best (lowest-numbered) tier ever competed in. */
  highestTier: number;
  /** Distinct clubs managed across the career (Manager career spans clubs). */
  clubsManaged: number;
  /** Domestic Cups lifted across the career. */
  cupTitles: number;
}

export function careerHonours(history: readonly SeasonRecord[]): CareerHonours {
  const clubs = new Set(history.map((r) => r.club).filter((c): c is string => !!c));
  return {
    divisionTitles: history.filter((r) => r.finishPos === 1).length,
    championOfEngland: history.some((r) => r.outcome === 'champion'),
    promotions: history.filter((r) => r.outcome === 'promoted' || r.outcome === 'champion').length,
    relegations: history.filter((r) => r.outcome === 'relegated' || r.outcome === 'sacked').length,
    seasonsPlayed: history.length,
    highestTier: history.length ? Math.min(...history.map((r) => r.tier)) : Number.POSITIVE_INFINITY,
    // At least the current club once a season's been played, even on legacy
    // records that predate the per-season club field.
    clubsManaged: Math.max(clubs.size, history.length ? 1 : 0),
    cupTitles: history.filter((r) => r.cupWon).length,
  };
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
  /** Owned players whose expiring contract the manager has chosen to renew. */
  renewed: string[];
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

// Fictional "unknown" journeymen — your starting squad in a new Career. Greyer,
// blander names than the academy prospects, to read as forgettable nobodies you
// upgrade by signing real players.
const UNKNOWN_FIRST = [
  'Gary', 'Dean', 'Lee', 'Carl', 'Wayne', 'Barry', 'Neil', 'Craig', 'Scott',
  'Ross', 'Glen', 'Shaun', 'Dale', 'Kurt', 'Ricky', 'Lewis',
];
const UNKNOWN_LAST = [
  'Stubbs', 'Pennington', 'Marsh', 'Hodgkiss', 'Bardsley', 'Crook', 'Tunnicliffe',
  'Whitlow', 'Pugh', 'Catterick', 'Rowett', 'Bramall', 'Doidge', 'Hopper',
  'Grimshaw', 'Ferris',
];

/** Role spread of a generated starting squad (15: a full XI + four for the bench). */
const UNKNOWN_SQUAD: Record<Role, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

/**
 * Generate a full squad of fictional "unknown" players — the grey, low-rated
 * journeymen you start a new Career with. Deliberately rated BELOW the real
 * free-agent floor (overall < ~55) so that signing ANY real player is a clear
 * upgrade. Deterministic per seed; ids (`unknown-…`) never collide with the real
 * pool. They're owned like any signing (age, contracts) — just forgettable.
 */
export function generateUnknowns(seed: string | number): Player[] {
  const rng = new Rng(`${seed}-unknown`);
  const out: Player[] = [];
  let i = 0;
  for (const role of ALL_ROLES) {
    for (let n = 0; n < UNKNOWN_SQUAD[role]; n++, i++) {
      const first = UNKNOWN_FIRST[rng.int(0, UNKNOWN_FIRST.length - 1)];
      const last = UNKNOWN_LAST[rng.int(0, UNKNOWN_LAST.length - 1)];
      const primary = rng.int(40, 52); // stronger side — non-league grade
      const secondary = rng.int(28, 40);
      const attackLed = role === 'FWD' || role === 'MID';
      const attack = attackLed ? primary : secondary;
      const defense = attackLed ? secondary : primary;
      out.push({
        id: `unknown-${seed}-${i}`,
        name: `${first} ${last}`,
        cost: 0,
        stats: { attack: clamp(attack), defense: clamp(defense) },
        tags: ['unknown'],
        role,
        rarity: 'bronze',
        position: undefined,
        synergyTags: ['unknown'], // no real-world chemistry — another reason to upgrade
        era: 'Unknown',
      });
    }
  }
  return out;
}

/** Fresh meta for a newly acquired player (signed at their peak, on a full deal). */
export function newMeta(): CareerMeta {
  return { age: 0, growthLeft: 0, contractYears: DEFAULT_CONTRACT };
}

/** Meta for an academy youth (ramps up before plateauing; signs a long deal). */
export function youthMeta(): CareerMeta {
  return { age: 0, growthLeft: YOUTH_GROWTH_SEASONS, contractYears: YOUTH_CONTRACT };
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

    // Aging is stats-only; the contract is resolved separately (resolveContracts).
    nextMeta[id] = { age, growthLeft, contractYears: m.contractYears ?? DEFAULT_CONTRACT };
    roster[id] = { ...cur, stats: { attack: clamp(attack), defense: clamp(defense) } };
  }

  return { meta: nextMeta, roster };
}

/**
 * Run the squad's contracts down a season. Renewed players reset to a full deal;
 * everyone else loses a year, and anyone whose deal expires (and wasn't renewed)
 * LEAVES on a free transfer (Bosman). Pure. Returns the next meta (departed
 * players dropped) and the list of ids that walked.
 */
export function resolveContracts(
  ownedIds: readonly string[],
  meta: Record<string, CareerMeta>,
  renewed: ReadonlySet<string>
): { meta: Record<string, CareerMeta>; departed: string[] } {
  const nextMeta: Record<string, CareerMeta> = {};
  const departed: string[] = [];
  for (const id of ownedIds) {
    const m = meta[id] ?? newMeta();
    if (renewed.has(id)) {
      nextMeta[id] = { ...m, contractYears: DEFAULT_CONTRACT };
      continue;
    }
    const years = (m.contractYears ?? DEFAULT_CONTRACT) - 1;
    if (years <= 0) departed.push(id);
    else nextMeta[id] = { ...m, contractYears: years };
  }
  return { meta: nextMeta, departed };
}
