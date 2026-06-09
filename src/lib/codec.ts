/**
 * Async PvP team codes. Export the starting XI to a short, URL-safe string and
 * import an opponent's back.
 *
 * SECURITY POSTURE: the code is UNTRUSTED input. Only player ids + slot
 * positions are serialized — never stats or chemistry. On import everything is
 * re-validated against the local pool and chemistry is RECOMPUTED, so a tampered
 * code can't inflate an opponent. Malformed input fails gracefully, never throws.
 */

import LZString from 'lz-string';
import { POOL } from '@/data/pool';
import type { Player } from './types';
import { XI_SIZE } from './types';
import { DEFAULT_FORMATION, getFormation, slotRole } from './formations';
import { computeChemistry } from './chemistry';
import type { MatchTeam } from './engine';

const BY_ID = new Map(POOL.map((p) => [p.id, p]));

export const CODE_PREFIX = 'GAFFER';
export const CODE_VERSION = 1;
const MAX_NAME = 24;

export interface OpponentTeam extends MatchTeam {
  /** The decoded slot layout (for display / debugging). */
  xi: (string | null)[];
  /** Formation id the code was built with. */
  formation: string;
}

export type ImportResult =
  | { ok: true; team: OpponentTeam }
  | { ok: false; error: string };

interface Payload {
  /** team name */
  n: string;
  /** formation id (optional; defaults to 4-4-2 for legacy codes) */
  f?: string;
  /** xi: slot index → playerId | null */
  x: (string | null)[];
}

/** Serialize a starting XI into a `GAFFER-1-…` code. */
export function exportTeam(
  xi: (string | null)[],
  name = 'Imported XI',
  formationId: string = DEFAULT_FORMATION
): string {
  const payload: Payload = {
    n: name.slice(0, MAX_NAME),
    f: formationId,
    x: xi.slice(0, XI_SIZE),
  };
  const compressed = LZString.compressToEncodedURIComponent(
    JSON.stringify(payload)
  );
  return `${CODE_PREFIX}-${CODE_VERSION}-${compressed}`;
}

/**
 * Decode + validate an opponent code. Recomputes chemistry locally. Returns a
 * discriminated result — callers must handle `ok: false`.
 */
export function importTeam(code: string): ImportResult {
  const trimmed = (code ?? '').trim();
  const match = /^([A-Z]+)-(\d+)-(.+)$/.exec(trimmed);
  if (!match || match[1] !== CODE_PREFIX) {
    return { ok: false, error: 'Unrecognised code — expected GAFFER-1-…' };
  }

  const version = Number(match[2]);
  if (version !== CODE_VERSION) {
    return { ok: false, error: `Unsupported code version (${version}).` };
  }

  let json: string | null = null;
  try {
    json = LZString.decompressFromEncodedURIComponent(match[3]);
  } catch {
    return { ok: false, error: 'Corrupted code — could not decompress.' };
  }
  if (!json) return { ok: false, error: 'Corrupted code — could not decompress.' };

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Corrupted code — invalid data.' };
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as Payload).x) ||
    (payload as Payload).x.length !== XI_SIZE
  ) {
    return { ok: false, error: 'Invalid team data.' };
  }

  const formationId = (payload as Payload).f ?? DEFAULT_FORMATION;
  const formation = getFormation(formationId);

  const rawXi = (payload as Payload).x;
  const xi: (string | null)[] = [];
  for (let i = 0; i < XI_SIZE; i++) {
    const id = rawXi[i];
    if (id === null || id === undefined) {
      xi.push(null);
      continue;
    }
    if (typeof id !== 'string') return { ok: false, error: 'Invalid team data.' };
    const player = BY_ID.get(id);
    if (!player) return { ok: false, error: `Unknown player in code: ${id}` };
    if (slotRole(formation.id, i) !== player.role) {
      return { ok: false, error: 'Illegal formation in code.' };
    }
    xi.push(id);
  }

  const starters = xi
    .map((id) => (id ? BY_ID.get(id)! : null))
    .filter((p): p is Player => !!p);
  if (starters.length === 0) {
    return { ok: false, error: 'That team has no players.' };
  }

  const chem = computeChemistry(starters);
  const rawName = (payload as Payload).n;
  const name =
    typeof rawName === 'string' && rawName.trim()
      ? rawName.slice(0, MAX_NAME)
      : 'Imported XI';

  return {
    ok: true,
    team: {
      name,
      xi,
      formation: formation.id,
      squad: starters,
      attack: Math.round(chem.totalAttack),
      defense: Math.round(chem.totalDefense),
    },
  };
}

/** Build a shareable challenge URL that auto-loads this team as the opponent. */
export function challengeUrl(code: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
  return `${base}?vs=${encodeURIComponent(code)}`;
}

/** Extract a `?vs=` opponent code from a URL search string, if present. */
export function readChallengeCode(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get('vs');
  return code && code.trim() ? code.trim() : null;
}
