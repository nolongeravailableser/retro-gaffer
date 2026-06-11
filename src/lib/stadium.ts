/**
 * Stadium & facilities — career-only club development. Between seasons you
 * reinvest into three facilities, each of which buys one concrete in-season
 * edge. Pure & deterministic (no RNG); the store holds the levels on
 * `CareerState.facilities` and the review screen drives upgrades.
 *
 * - **Stadium** (capacity) → flat matchday income every matchweek.
 * - **Academy** (training) → more youth prospects in each intake.
 * - **Medical** (centre) → shaves rounds off new injuries.
 */

export type FacilityId = 'stadium' | 'academy' | 'medical';

export interface Facilities {
  stadium: number;
  academy: number;
  medical: number;
}

/** Levels run 0 (none) … MAX_LEVEL. */
export const MAX_LEVEL = 3;

export const FACILITY_IDS: FacilityId[] = ['stadium', 'academy', 'medical'];

export interface FacilityInfo {
  id: FacilityId;
  name: string;
  blurb: string;
  /** Per-level cost STEP (cost to reach level L = step × L). */
  step: number;
}

export const FACILITIES: Record<FacilityId, FacilityInfo> = {
  stadium: {
    id: 'stadium',
    name: 'Stadium',
    blurb: 'Bigger crowds — flat matchday income every matchweek.',
    step: 14,
  },
  academy: {
    id: 'academy',
    name: 'Academy',
    blurb: 'A wider net — more youth prospects in each intake.',
    step: 12,
  },
  medical: {
    id: 'medical',
    name: 'Medical Centre',
    blurb: 'Better treatment — knocks heal faster, injuries cost fewer rounds.',
    step: 10,
  },
};

export function newFacilities(): Facilities {
  return { stadium: 0, academy: 0, medical: 0 };
}

/** Cost (£m) to take a facility from its current level to the next. */
export function upgradeCost(id: FacilityId, currentLevel: number): number {
  return FACILITIES[id].step * (currentLevel + 1);
}

/** Can this facility be upgraded further? */
export function isMaxed(level: number): boolean {
  return level >= MAX_LEVEL;
}

/** Flat matchday income (£m/matchweek) from the stadium level. */
export function matchdayIncome(stadiumLevel: number): number {
  return stadiumLevel * 3;
}

/** Extra academy prospects offered per intake from the academy level. */
export function youthBonus(academyLevel: number): number {
  return academyLevel;
}

/** Rounds shaved off a new injury by the medical level (the injury may clear). */
export function injuryReduction(medicalLevel: number): number {
  return medicalLevel;
}

/** £m/matchweek running cost per facility level, before division scaling. */
export const UPKEEP_PER_LEVEL = 0.75;

/**
 * Recurring facility running cost (£m/matchweek). A big, well-appointed club is
 * expensive to run — and more so in a higher division (`tierMult` passed in by
 * the caller). This is the money SINK that keeps wealth meaningful at the top:
 * once your squad is complete, your stadium/academy/medical still cost real
 * cash every week, so banked millions get drawn down rather than hoarded.
 * Career only. Tuned against the career balance sim.
 */
export function facilityUpkeep(f: Facilities, tierMult: number): number {
  const levels = f.stadium + f.academy + f.medical;
  return Math.round(levels * UPKEEP_PER_LEVEL * tierMult);
}
