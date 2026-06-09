/**
 * Export/Import a whole run as a short text string — a backend-free way to move
 * a save between devices (desktop ↔ mobile). Same posture as the team codec:
 * versioned, validated, never trusts the input, fails gracefully.
 */

import LZString from 'lz-string';
import {
  CURRENT_VERSION,
  migrateSave,
  isValidSave,
} from '@/store/persistence';

export const SAVE_PREFIX = 'GAFFER-SAVE';

export type SaveImport =
  | { ok: true; state: Record<string, unknown> }
  | { ok: false; error: string };

/** Serialize a partialized run into a `GAFFER-SAVE-7-…` code. */
export function encodeSave(state: Record<string, unknown>): string {
  const payload = LZString.compressToEncodedURIComponent(JSON.stringify(state));
  return `${SAVE_PREFIX}-${CURRENT_VERSION}-${payload}`;
}

/** Decode + validate + migrate a save code back into run state. */
export function decodeSave(code: string): SaveImport {
  const match = /^([A-Z-]+)-(\d+)-(.+)$/.exec((code ?? '').trim());
  if (!match || match[1] !== SAVE_PREFIX) {
    return { ok: false, error: 'Unrecognised save code — expected GAFFER-SAVE-…' };
  }
  const version = Number(match[2]);
  if (!Number.isFinite(version) || version > CURRENT_VERSION) {
    return { ok: false, error: 'This save is from a newer version of the game.' };
  }

  let json: string | null = null;
  try {
    json = LZString.decompressFromEncodedURIComponent(match[3]);
  } catch {
    return { ok: false, error: 'Corrupted save code.' };
  }
  if (!json) return { ok: false, error: 'Corrupted save code.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Corrupted save code.' };
  }

  const migrated = migrateSave(parsed, version);
  if (!isValidSave(migrated)) {
    return { ok: false, error: 'Save data is invalid.' };
  }
  return { ok: true, state: migrated as Record<string, unknown> };
}
