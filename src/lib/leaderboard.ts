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

/** Today's top entries, or null when the leaderboard is unavailable. */
export async function fetchDailyTop(day: string): Promise<LeaderboardEntry[] | null> {
  try {
    const resp = await fetch(`/api/daily?day=${encodeURIComponent(day)}`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { entries?: LeaderboardEntry[] };
    if (!Array.isArray(data.entries)) return null;
    return data.entries.filter(
      (e) => typeof e.club === 'string' && typeof e.score === 'number'
    );
  } catch {
    return null;
  }
}
