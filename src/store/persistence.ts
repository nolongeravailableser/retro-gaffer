/**
 * Save-state plumbing for the Zustand store (client-only, no backend).
 *
 *  - Stable key `gaffer-run` + numeric `version` with `migrate()`, so shipping a
 *    schema change upgrades an in-progress run instead of wiping it.
 *  - A safe storage wrapper that survives corrupted blobs (clears + flags them).
 *  - A one-time import of the legacy `gaffer-run-v7` key so this very change
 *    doesn't lose anyone's active run.
 *
 * Principle: additive fields are free (the store's `merge` fills them from the
 * fresh defaults); migrators only handle real transforms/defaults.
 */

import { XI_SIZE, BENCH_SIZE } from '@/lib/types';
import { DEFAULT_FORMATION } from '@/lib/formations';
import { NO_MODIFIERS } from '@/lib/effects';
import { STARTING_BANKROLL } from '@/lib/economy';
import { STARTING_LIVES } from '@/lib/ladder';

export const SAVE_KEY = 'gaffer-run';
export const LEGACY_KEY = 'gaffer-run-v7';
/** Current persisted-state generation (see the migration map). */
export const CURRENT_VERSION = 28;

/** Bottom-tier value at the v21 migration (National League). Frozen here so the
 *  migration stays stable even if the pyramid is later re-tiered. */
const V21_BOTTOM_TIER = 5;

type Save = Record<string, unknown>;

const freshSeed = () => ((Date.now() >>> 1) & 0x7fffffff) || 7;

/**
 * Per-version upgrade steps. Each returns `{ ...defaults, ...saved }` so an
 * existing value always wins and only missing fields are defaulted.
 */
const MIGRATIONS: Record<number, (s: Save) => Save> = {
  3: (s) => ({ formation: DEFAULT_FORMATION, ...s }),
  4: (s) => ({ record: { w: 0, d: 0, l: 0 }, ...s }),
  5: (s) => ({ pack: 'all', ...s }),
  6: (s) => ({
    round: 1,
    lives: STARTING_LIVES,
    streak: 0,
    runStatus: 'playing',
    runSeed: freshSeed(),
    bestStreak: 0,
    peakBankroll: typeof s.bankroll === 'number' ? s.bankroll : STARTING_BANKROLL,
    shopLocked: false,
    best: { round: 0 },
    daily: null,
    ...s,
  }),
  7: (s) => ({
    relics: [],
    roundMods: NO_MODIFIERS,
    event: null,
    freeRefreshUsed: false,
    wager: 0,
    lifeBuybacks: 0,
    shield: false,
    ...s,
  }),
  8: (s) => ({
    suspensions: [],
    injuries: {},
    ...s,
  }),
  9: (s) => ({
    mode: 'classic',
    ...s,
  }),
  10: (s) => ({
    mutator: null,
    ...s,
  }),
  11: (s) => ({
    scenario: null,
    scenarioStars: {},
    ...s,
  }),
  12: (s) => ({
    career: null,
    careerReview: null,
    careerBest: 0,
    ...s,
  }),
  13: (s) => ({
    dryStreak: 0,
    ...s,
  }),
  14: (s) => ({
    collection: [],
    bestScore: {},
    ...s,
  }),
  15: (s) => ({
    dailyCompleted: null,
    ...s,
  }),
  // Existing players are already past onboarding — never wall them with the
  // first-time flow. clubName/managerName stay unset (fall back to 'Your XI')
  // and can be set later from the Club settings. A truly fresh install has no
  // save to migrate, so it keeps the create() default of onboarded:false.
  16: (s) => ({
    onboarded: true,
    ...s,
  }),
  // Kits: existing saves keep the classic strip until they design one.
  17: (s) => ({
    kit: null,
    ...s,
  }),
  18: (s) => ({
    achievements: [],
    ...s,
  }),
  // Player histories start empty; they accrue from the next match played.
  19: (s) => ({
    playerHistory: {},
    ...s,
  }),
  // League-Season state — null unless a league run is in progress.
  20: (s) => ({
    league: null,
    ...s,
  }),
  // Career became a league pyramid: give any legacy (board-target) career a
  // starting tier and drop the obsolete targetRound. A migrated career has no
  // `league` yet — the store regenerates one for its tier on rehydrate.
  21: (s) => {
    if (!s.career || typeof s.career !== 'object') return s;
    const { targetRound: _drop, ...rest } = s.career as Record<string, unknown>;
    return { ...s, career: { tier: V21_BOTTOM_TIER, ...rest } };
  },
  // Stadium development: existing careers start with no facilities.
  22: (s) => {
    if (!s.career || typeof s.career !== 'object') return s;
    return {
      ...s,
      career: { facilities: { stadium: 0, academy: 0, medical: 0 }, ...(s.career as object) },
    };
  },
  // Career Hub: existing careers start with an empty history log.
  23: (s) => {
    if (!s.career || typeof s.career !== 'object') return s;
    return { ...s, career: { history: [], ...(s.career as object) } };
  },
  // Club inbox: existing saves start with an empty message feed.
  24: (s) => (Array.isArray((s as { inbox?: unknown }).inbox) ? s : { ...s, inbox: [] }),
  // Contracts & Bosman: give every existing career-squad player a default deal,
  // and any pending review an empty renewals list.
  25: (s) => {
    const career = (s as { career?: unknown }).career;
    if (!career || typeof career !== 'object') return s;
    const c = career as { meta?: Record<string, { contractYears?: number }> };
    const meta = c.meta && typeof c.meta === 'object' ? c.meta : {};
    const nextMeta: Record<string, unknown> = {};
    for (const [id, m] of Object.entries(meta)) {
      nextMeta[id] = m && typeof m === 'object' && typeof m.contractYears === 'number'
        ? m
        : { ...(m as object), contractYears: 3 };
    }
    const review = (s as { careerReview?: unknown }).careerReview;
    const nextReview =
      review && typeof review === 'object' && !Array.isArray((review as { renewed?: unknown }).renewed)
        ? { ...(review as object), renewed: [] }
        : review;
    return { ...s, career: { ...(career as object), meta: nextMeta }, careerReview: nextReview };
  },
  // Training/fatigue: default focus + empty condition maps for existing saves.
  26: (s) => {
    const o = s as { training?: unknown; sharpness?: unknown; fatigue?: unknown };
    return {
      ...s,
      training: typeof o.training === 'string' ? o.training : 'balanced',
      sharpness: o.sharpness && typeof o.sharpness === 'object' ? o.sharpness : {},
      fatigue: o.fatigue && typeof o.fatigue === 'object' ? o.fatigue : {},
    };
  },
  // Cup mode: existing saves have no active cup.
  27: (s) => ('cup' in (s as object) ? s : { ...s, cup: null }),
  // Operational difficulty: existing saves play on Standard (today's behaviour).
  28: (s) => (typeof (s as { difficulty?: unknown }).difficulty === 'string'
    ? s
    : { ...s, difficulty: 'standard' }),
};

/** Upgrade a saved blob from its version to CURRENT_VERSION. */
export function migrateSave(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== 'object') return persisted;
  let s = persisted as Save;
  for (let v = version + 1; v <= CURRENT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) s = step(s);
  }
  return s;
}

/** Cheap structural sanity check — catches truncated/tampered saves. */
export function isValidSave(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false;
  const o = s as Save;
  return (
    typeof o.bankroll === 'number' &&
    Array.isArray(o.xi) &&
    o.xi.length === XI_SIZE &&
    Array.isArray(o.bench) &&
    o.bench.length <= BENCH_SIZE &&
    Array.isArray(o.owned)
  );
}

// --- corrupted-save flag, consumed once by the UI on mount ---
let loadError = false;
export function consumeLoadError(): boolean {
  const e = loadError;
  loadError = false;
  return e;
}

// The exact string this tab last read/wrote — lets the cross-tab listener tell
// a genuine external change from the echo of its own write (no sync loop).
let lastSavedRaw: string | null = null;

/** localStorage wrapper that never throws and self-heals a corrupt blob. */
export const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      const raw = localStorage.getItem(name);
      if (raw == null) return null;
      JSON.parse(raw); // validate it at least parses
      if (name === SAVE_KEY) lastSavedRaw = raw;
      return raw;
    } catch {
      loadError = true;
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (name === SAVE_KEY) lastSavedRaw = value;
    try {
      localStorage.setItem(name, value);
    } catch {
      /* quota / private mode — ignore, autosave just no-ops */
    }
  },
  removeItem: (name: string): void => {
    if (name === SAVE_KEY) lastSavedRaw = null;
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

/**
 * Decide whether a `storage` event is a genuine save change made by ANOTHER
 * tab (vs the echo of our own write or a removal/corrupt write). Returns the new
 * raw value to sync to, or null to ignore. Records it so we don't re-sync.
 */
export function externalSaveChange(
  key: string | null,
  newValue: string | null
): string | null {
  if (key !== SAVE_KEY) return null;
  if (newValue == null) return null; // removal — keep our run
  if (newValue === lastSavedRaw) return null; // our own write echoed back
  try {
    JSON.parse(newValue);
  } catch {
    return null; // another tab wrote garbage — don't adopt it
  }
  lastSavedRaw = newValue;
  return newValue;
}

/** One-time: adopt the legacy v7 blob so this update keeps active runs. */
export function importLegacySave(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(SAVE_KEY)) return; // already on the new key
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) localStorage.setItem(SAVE_KEY, legacy);
  } catch {
    /* ignore */
  }
}
