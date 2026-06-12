/**
 * Training, match sharpness & fatigue (Career & League) — the weekly loop.
 *
 * Pure & deterministic. Two per-player conditions, driven by playing time, that
 * fold into the existing match-strength modifier pipeline (no engine change):
 *
 * - **Sharpness** — match readiness. Rises when a player STARTS, decays on the
 *   bench. Low sharpness = a small performance penalty (a rusty squad player
 *   isn't ready). Rewards a settled XI.
 * - **Fatigue** — accumulated load. Rises when a player starts, recovers (a
 *   fraction) every week. High fatigue = a small penalty. Rewards rotation /
 *   resting tired stars.
 *
 * Plus a weekly **training focus** that lightly tilts the squad (attacking /
 * defensive boosts via role multipliers; fitness speeds recovery).
 *
 * Tuned SUBTLE + GENTLE: a regular starter sits near neutral (sharpness high,
 * fatigue at a mild equilibrium), so the average team strength barely moves and
 * the career balance sim stays valid — the system is a skill layer (good
 * rotation = a small edge), not a difficulty swing.
 */

import { NO_MODIFIERS, type MatchModifiers } from './effects';
import type { Role } from './types';

export type TrainingFocus = 'attacking' | 'balanced' | 'defensive' | 'fitness';

export interface FocusInfo {
  id: TrainingFocus;
  label: string;
  blurb: string;
}

export const TRAINING_FOCI: FocusInfo[] = [
  { id: 'attacking', label: 'Attacking', blurb: 'Sharper going forward (+ attackers).' },
  { id: 'balanced', label: 'Balanced', blurb: 'No emphasis — steady all round.' },
  { id: 'defensive', label: 'Defensive', blurb: 'Tighten up (+ defenders).' },
  { id: 'fitness', label: 'Fitness', blurb: 'Recover faster — beats fatigue.' },
];

export const DEFAULT_FOCUS: TrainingFocus = 'balanced';

const clamp = (v: number) => Math.max(0, Math.min(100, v));

// --- Sharpness -------------------------------------------------------------

export const SHARP_START = 70; // a fresh signing arrives match-ready-ish
export const SHARP_GAIN = 8; // per match started
export const SHARP_DECAY = 6; // per match benched / unused
export const SHARP_FULL = 70; // at/above this → no penalty
export const SHARP_MAX_PENALTY = 0.05; // 5% at sharpness 0

export function nextSharpness(cur: number | undefined, played: boolean): number {
  return clamp((cur ?? SHARP_START) + (played ? SHARP_GAIN : -SHARP_DECAY));
}

/** Match multiplier from sharpness — 1.0 when sharp, down to 0.95 when rusty. */
export function sharpnessMult(s: number = SHARP_START): number {
  const r = Math.min(s, SHARP_FULL) / SHARP_FULL; // 0..1
  return 1 - SHARP_MAX_PENALTY * (1 - r);
}

// --- Fatigue ---------------------------------------------------------------

export const FAT_PER_MATCH = 18; // load added by starting
export const FAT_RECOVERY = 0.25; // fraction shed each week (everyone rests between games)
export const FAT_RECOVERY_FIT = 0.4; // fitness focus recovers more
export const FAT_FREE = 55; // below this → no penalty (a regular starter sits ~72)
export const FAT_MAX_PENALTY = 0.05; // 5% at fatigue 100

export function nextFatigue(
  cur: number | undefined,
  played: boolean,
  focus: TrainingFocus = DEFAULT_FOCUS
): number {
  const rec = focus === 'fitness' ? FAT_RECOVERY_FIT : FAT_RECOVERY;
  let v = (cur ?? 0) * (1 - rec); // recover a fraction first
  if (played) v += FAT_PER_MATCH; // then add this week's load
  return clamp(v);
}

/** Match multiplier from fatigue — 1.0 when fresh, down to 0.95 when shattered. */
export function fatigueMult(f: number = 0): number {
  if (f <= FAT_FREE) return 1;
  const r = (f - FAT_FREE) / (100 - FAT_FREE); // 0..1
  return 1 - FAT_MAX_PENALTY * r;
}

/** Combined per-player condition multiplier (sharpness × fatigue). */
export function conditionMult(sharpness?: number, fatigue?: number): number {
  return sharpnessMult(sharpness) * fatigueMult(fatigue);
}

// --- Match modifiers -------------------------------------------------------

/** Subtle role tilt from the training focus (folds into MatchModifiers.role). */
export function focusModifiers(focus: TrainingFocus): MatchModifiers {
  const role: Partial<Record<Role, number>> = {};
  if (focus === 'attacking') {
    role.FWD = 1.03;
    role.MID = 1.015;
  } else if (focus === 'defensive') {
    role.DEF = 1.03;
    role.GK = 1.015;
  }
  return { ...NO_MODIFIERS, role };
}

/**
 * Per-player condition modifiers (sharpness × fatigue) for the starting XI,
 * folded into MatchModifiers.player. Players not listed default to 1.
 */
export function conditionModifiers(
  starterIds: readonly string[],
  sharpness: Record<string, number>,
  fatigue: Record<string, number>
): MatchModifiers {
  const player: Record<string, number> = {};
  for (const id of starterIds) {
    player[id] = conditionMult(sharpness[id], fatigue[id]);
  }
  return { ...NO_MODIFIERS, player };
}

/** A 0–100 → 3-band label for compact UI (Fresh/OK/Tired, Sharp/OK/Rusty). */
export function sharpnessBand(s: number = SHARP_START): 'sharp' | 'ok' | 'rusty' {
  if (s >= SHARP_FULL) return 'sharp';
  if (s >= 45) return 'ok';
  return 'rusty';
}
export function fatigueBand(f: number = 0): 'fresh' | 'ok' | 'tired' {
  if (f <= FAT_FREE) return 'fresh';
  if (f <= 80) return 'ok';
  return 'tired';
}
