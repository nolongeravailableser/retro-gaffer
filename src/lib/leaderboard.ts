/**
 * Daily leaderboard client. Talks to /api/daily (Vercel function + Upstash
 * Redis) and DEGRADES GRACEFULLY: any failure — backend not provisioned (503),
 * dev server without /api, offline play — resolves to null and the UI simply
 * hides the board. Submitting is fire-and-forget and deduped per day.
 *
 * Identity is an anonymous, device-local id (no accounts): scores are
 * client-computed and bounds-checked server-side — friendly competition, not
 * an anti-cheat system.
 */

export interface LeaderboardEntry {
  id: string;
  club: string;
  score: number;
}

const ID_KEY = 'gaffer-lbid';
const SENT_PREFIX = 'gaffer-lbsent:';

/** Stable anonymous id for this device (created once). */
export function leaderboardId(): string {
  try {
    const existing = localStorage.getItem(ID_KEY);
    if (existing) return existing;
    const id = `g-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ID_KEY, id);
    return id;
  } catch {
    return 'g-anonymous';
  }
}

/** Has today's score already been submitted from this device? */
function alreadySent(day: string): boolean {
  try {
    return localStorage.getItem(`${SENT_PREFIX}${day}`) === '1';
  } catch {
    return false;
  }
}

function markSent(day: string): void {
  try {
    localStorage.setItem(`${SENT_PREFIX}${day}`, '1');
  } catch {
    /* private mode — may resubmit, ZADD GT makes that harmless */
  }
}

/** Submit a finished Daily's score. Fire-and-forget; never throws. */
export async function submitDailyScore(opts: {
  day: string;
  score: number;
  club: string | null;
}): Promise<void> {
  if (alreadySent(opts.day) || opts.score <= 0) return;
  try {
    const resp = await fetch('/api/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: opts.day,
        score: Math.floor(opts.score),
        club: opts.club ?? 'Anonymous FC',
        id: leaderboardId(),
      }),
    });
    if (resp.ok || resp.status === 204) markSent(opts.day);
  } catch {
    /* offline / no backend — quietly skip */
  }
}

// Short-lived cache: tab-hopping to Records shouldn't refetch (or blank) the
// board, nor burn API commands. Entries refresh after a minute.
const CACHE_TTL_MS = 60_000;
const topCache = new Map<string, { at: number; entries: LeaderboardEntry[] | null }>();

/** Today's top entries, or null when the leaderboard is unavailable. */
export async function fetchDailyTop(day: string): Promise<LeaderboardEntry[] | null> {
  const cached = topCache.get(day);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.entries;
  try {
    const resp = await fetch(`/api/daily?day=${encodeURIComponent(day)}`);
    if (!resp.ok) {
      topCache.set(day, { at: Date.now(), entries: null });
      return null;
    }
    const data = (await resp.json()) as { entries?: LeaderboardEntry[] };
    const entries = Array.isArray(data.entries)
      ? data.entries.filter((e) => typeof e.club === 'string' && typeof e.score === 'number')
      : null;
    topCache.set(day, { at: Date.now(), entries });
    return entries;
  } catch {
    topCache.set(day, { at: Date.now(), entries: null });
    return null;
  }
}
