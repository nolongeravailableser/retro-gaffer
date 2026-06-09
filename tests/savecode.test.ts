import { describe, it, expect } from 'vitest';
import { encodeSave, decodeSave, SAVE_PREFIX } from '@/lib/savecode';
import {
  migrateSave,
  isValidSave,
  CURRENT_VERSION,
  externalSaveChange,
  safeStorage,
} from '@/store/persistence';

function validSave(over: Record<string, unknown> = {}) {
  return {
    bankroll: 22,
    owned: ['p_henry_04'],
    shop: [null, null, null],
    shopSeed: 12345,
    pack: 'all',
    formation: '442',
    xi: Array(11).fill(null),
    bench: [],
    record: { w: 2, d: 1, l: 0 },
    round: 4,
    lives: 2,
    streak: 1,
    runStatus: 'playing',
    runSeed: 99,
    daily: null,
    bestStreak: 3,
    peakBankroll: 40,
    shopLocked: false,
    best: { round: 7 },
    relics: ['hairdryer'],
    roundMods: { role: {}, player: {}, chemAmplify: 1, teamMult: 1 },
    event: null,
    freeRefreshUsed: false,
    wager: 0,
    lifeBuybacks: 1,
    shield: true,
    ...over,
  };
}

describe('isValidSave', () => {
  it('accepts a well-formed save', () => {
    expect(isValidSave(validSave())).toBe(true);
  });
  it('rejects garbage and structurally broken saves', () => {
    expect(isValidSave(null)).toBe(false);
    expect(isValidSave({ bankroll: 5 })).toBe(false); // no xi
    expect(isValidSave(validSave({ xi: Array(9).fill(null) }))).toBe(false); // wrong length
  });
});

describe('save code round-trip', () => {
  it('encode → decode reproduces the run', () => {
    const save = validSave();
    const code = decodeSave(encodeSave(save));
    expect(code.ok).toBe(true);
    if (code.ok) expect(code.state).toEqual(save);
  });

  it('produces a GAFFER-SAVE-<version>- prefix', () => {
    expect(encodeSave(validSave())).toMatch(new RegExp(`^${SAVE_PREFIX}-${CURRENT_VERSION}-`));
  });
});

describe('save code rejects bad input', () => {
  it('rejects junk / wrong prefix', () => {
    expect(decodeSave('').ok).toBe(false);
    expect(decodeSave('hello').ok).toBe(false);
    expect(decodeSave('GAFFER-1-abc').ok).toBe(false); // team code, not a save
  });
  it('rejects a newer-version save', () => {
    const code = encodeSave(validSave()).replace(`-${CURRENT_VERSION}-`, `-${CURRENT_VERSION + 1}-`);
    const r = decodeSave(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer/i);
  });
  it('rejects a corrupted payload', () => {
    expect(decodeSave(`${SAVE_PREFIX}-${CURRENT_VERSION}-$$$notvalid$$$`).ok).toBe(false);
  });
});

describe('migrations', () => {
  it('upgrades a pre-events (v6) save by defaulting the new fields', () => {
    const old = validSave();
    // Strip the v7 additions to simulate a save from an older build.
    for (const k of ['relics', 'roundMods', 'event', 'freeRefreshUsed', 'wager', 'lifeBuybacks', 'shield']) {
      delete (old as Record<string, unknown>)[k];
    }
    const migrated = migrateSave(old, 6) as Record<string, unknown>;
    expect(migrated.relics).toEqual([]);
    expect(migrated.wager).toBe(0);
    expect(migrated.shield).toBe(false);
    expect(migrated.bankroll).toBe(22); // existing data preserved
  });

  it('keeps existing values when a field is already present', () => {
    const migrated = migrateSave(validSave({ relics: ['agent'] }), 6) as Record<string, unknown>;
    expect(migrated.relics).toEqual(['agent']);
  });
});

describe('cross-tab sync guard (externalSaveChange)', () => {
  it('ignores events for other keys and removals', () => {
    expect(externalSaveChange('something-else', '{"x":1}')).toBeNull();
    expect(externalSaveChange('gaffer-run', null)).toBeNull();
  });

  it('ignores the echo of our own write, but adopts a genuine external change', () => {
    safeStorage.setItem('gaffer-run', '{"state":{"a":1},"version":7}'); // our write
    // Same value echoed back from another tab → ignore (no sync loop).
    expect(externalSaveChange('gaffer-run', '{"state":{"a":1},"version":7}')).toBeNull();
    // A different, valid value from another tab → adopt it.
    const other = '{"state":{"a":2},"version":7}';
    expect(externalSaveChange('gaffer-run', other)).toBe(other);
    // Now it's recorded, so re-seeing it is ignored.
    expect(externalSaveChange('gaffer-run', other)).toBeNull();
  });

  it('refuses to adopt garbage written by another tab', () => {
    expect(externalSaveChange('gaffer-run', 'not json {')).toBeNull();
  });
});
