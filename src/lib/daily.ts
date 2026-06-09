/**
 * Daily Challenge: a deterministic run keyed to the calendar date. Everyone who
 * plays the same day gets the identical opening shop and ladder opponents, so
 * the only variable is your decisions — making scores directly comparable.
 * Pure & UI-agnostic.
 */

import { hashSeed } from './rng';
import { ladderTier } from './ladder';

/** Local-date key, e.g. '2026-06-09'. */
export function dailyKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Stable seed for a given day's challenge. */
export function dailySeed(key: string): number {
  return hashSeed(`gaffer-daily-${key}`);
}

export interface RunResult {
  daily: string | null;
  status: 'playing' | 'won' | 'lost';
  round: number;
  record: { w: number; d: number; l: number };
  peakBankroll: number;
  bestStreak: number;
}

/** A short, copy-pasteable summary of a finished run. */
export function formatRunResult(r: RunResult): string {
  const head = r.daily
    ? `Retro Gaffer — Daily ${r.daily}`
    : 'Retro Gaffer';
  const reached =
    r.status === 'won'
      ? 'CHAMPIONS OF EUROPE 🏆'
      : `Reached ${ladderTier(r.round)} (Round ${r.round})`;
  return [
    head,
    reached,
    `${r.record.w}W-${r.record.d}D-${r.record.l}L · best streak ${r.bestStreak} · peak £${r.peakBankroll}M`,
  ].join('\n');
}
