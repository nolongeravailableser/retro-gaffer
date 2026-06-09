import { describe, it, expect } from 'vitest';
import {
  exportTeam,
  importTeam,
  CODE_PREFIX,
  challengeUrl,
  readChallengeCode,
} from '@/lib/codec';
import { computeChemistry } from '@/lib/chemistry';
import { getFormation } from '@/lib/formations';
import { XI_SIZE } from '@/lib/types';
import { POOL } from '@/data/pool';

const byRole = (r: string) => POOL.filter((p) => p.role === r);

/** Build a legal XI of real pool players for any formation. */
function legalXi(formationId = '442'): (string | null)[] {
  const slots = getFormation(formationId).slots;
  const queues: Record<string, string[]> = {
    GK: byRole('GK').map((p) => p.id),
    DEF: byRole('DEF').map((p) => p.id),
    MID: byRole('MID').map((p) => p.id),
    FWD: byRole('FWD').map((p) => p.id),
  };
  return slots.map((role) => queues[role].shift() ?? null);
}

describe('round-trip invariant', () => {
  it('import(export(xi)) reproduces the team and chemistry', () => {
    const xi = legalXi();
    const code = exportTeam(xi, 'The Lads');
    const result = importTeam(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.team.name).toBe('The Lads');
    expect(result.team.xi).toEqual(xi);

    const starters = xi
      .map((id) => POOL.find((p) => p.id === id)!)
      .filter(Boolean);
    const chem = computeChemistry(starters);
    expect(result.team.attack).toBe(Math.round(chem.totalAttack));
    expect(result.team.defense).toBe(Math.round(chem.totalDefense));
  });

  it('survives a partial XI (gaps stay null)', () => {
    const xi: (string | null)[] = Array(XI_SIZE).fill(null);
    xi[9] = byRole('FWD')[0].id;
    const result = importTeam(exportTeam(xi));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.team.xi).toEqual(xi);
  });

  it('produces a GAFFER-1- prefixed code', () => {
    expect(exportTeam(legalXi())).toMatch(new RegExp(`^${CODE_PREFIX}-1-`));
  });

  it('round-trips a non-default formation (4-3-3)', () => {
    const xi = legalXi('433');
    const result = importTeam(exportTeam(xi, 'Front Three', '433'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.team.formation).toBe('433');
      expect(result.team.xi).toEqual(xi);
    }
  });

  it('rejects a code whose roles do not match its formation', () => {
    // A legal 3-5-2 XI re-labelled as 4-4-2 will mis-slot a MID into a DEF slot.
    const xi352 = legalXi('352');
    const tampered = exportTeam(xi352, 'X', '352').replace(/.$/, '');
    // (the above is just to ensure export works; the real check below)
    expect(typeof tampered).toBe('string');
    const code = exportTeam(xi352, 'X', '442');
    const r = importTeam(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/formation/i);
  });
});

describe('challenge links', () => {
  it('builds and reads back a ?vs= code', () => {
    const code = exportTeam(legalXi(), 'Lads');
    const url = challengeUrl(code, 'https://game.example/');
    expect(url).toContain('?vs=');
    const search = url.slice(url.indexOf('?'));
    expect(readChallengeCode(search)).toBe(code);
  });

  it('returns null when there is no challenge code', () => {
    expect(readChallengeCode('')).toBeNull();
    expect(readChallengeCode('?foo=bar')).toBeNull();
  });
});

describe('graceful failure on bad input', () => {
  it('rejects empty / junk strings', () => {
    expect(importTeam('').ok).toBe(false);
    expect(importTeam('hello world').ok).toBe(false);
    expect(importTeam('FIFA-1-abc').ok).toBe(false);
  });

  it('rejects an unsupported version', () => {
    const code = exportTeam(legalXi()).replace('GAFFER-1-', 'GAFFER-2-');
    const r = importTeam(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/version/i);
  });

  it('rejects a corrupted payload', () => {
    const r = importTeam('GAFFER-1-not-valid-lz-$$$');
    expect(r.ok).toBe(false);
  });

  it('rejects unknown player ids', () => {
    const xi: (string | null)[] = Array(XI_SIZE).fill(null);
    xi[9] = 'p_999';
    const r = importTeam(exportTeam(xi));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unknown/i);
  });

  it('rejects an illegal formation (wrong role in slot)', () => {
    const xi: (string | null)[] = Array(XI_SIZE).fill(null);
    xi[0] = byRole('FWD')[0].id; // forward in the GK slot
    const r = importTeam(exportTeam(xi));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/formation/i);
  });

  it('rejects an empty team', () => {
    const r = importTeam(exportTeam(Array(XI_SIZE).fill(null)));
    expect(r.ok).toBe(false);
  });

  it('never throws, whatever the input', () => {
    for (const bad of ['', '   ', 'GAFFER', 'GAFFER-1-', 'GAFFER-x-y', '🤝']) {
      expect(() => importTeam(bad)).not.toThrow();
    }
  });
});
