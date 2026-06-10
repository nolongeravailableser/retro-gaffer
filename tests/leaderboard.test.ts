import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leaderboardId, submitDailyScore, fetchDailyTop } from '@/lib/leaderboard';

// Minimal localStorage for the node test environment.
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', memoryStorage());
});

describe('leaderboardId', () => {
  it('creates once and stays stable', () => {
    const a = leaderboardId();
    const b = leaderboardId();
    expect(a).toBe(b);
    expect(a).toMatch(/^g-[a-z0-9]+$/);
  });
});

describe('submitDailyScore', () => {
  it('POSTs a sanitized payload and dedupes per day', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    await submitDailyScore({ day: '2026-06-10', score: 123456.7, club: 'Pixel Rovers' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ day: '2026-06-10', score: 123456, club: 'Pixel Rovers' });
    expect(body.id).toBe(leaderboardId());
    // Second call for the same day is a no-op.
    await submitDailyScore({ day: '2026-06-10', score: 999999, club: 'Pixel Rovers' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never throws when the backend is missing, and can retry later', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(
      submitDailyScore({ day: '2026-06-11', score: 100, club: null })
    ).resolves.toBeUndefined();
    // Failure does NOT mark the day as sent — a later attempt still fires.
    const ok = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', ok);
    await submitDailyScore({ day: '2026-06-11', score: 100, club: null });
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('skips zero/negative scores', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await submitDailyScore({ day: '2026-06-12', score: 0, club: 'X' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchDailyTop', () => {
  it('returns entries on success and null on any failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [{ id: 'a', club: 'FC A', score: 9000 }] }),
    }));
    expect(await fetchDailyTop('2026-06-10')).toEqual([{ id: 'a', club: 'FC A', score: 9000 }]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await fetchDailyTop('2026-06-10')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    expect(await fetchDailyTop('2026-06-10')).toBeNull();
  });
});
