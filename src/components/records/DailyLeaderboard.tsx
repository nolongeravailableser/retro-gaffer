import { useEffect, useState } from 'react';
import { Globe2, Crown, WifiOff } from 'lucide-react';
import { fetchDailyTop, leaderboardId, type LeaderboardEntry } from '@/lib/leaderboard';
import { formatScore } from '@/lib/score';

interface DailyLeaderboardProps {
  /** Date key of the board to show (e.g. today's, or a finished run's day). */
  day: string;
  /** Compact mode for embedding in the run-over modal. */
  compact?: boolean;
}

/**
 * Today's global Daily Gauntlet standings. The backend is optional (Vercel +
 * Upstash) — when it's unreachable (offline / dev / 503) the dedicated panel
 * explains the absence rather than vanishing, but the compact embed in the
 * run-over modal stays invisible until there's real data so it never intrudes
 * on the end-of-run moment.
 */
export default function DailyLeaderboard({ day, compact = false }: DailyLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setEntries(null);
    void fetchDailyTop(day).then((e) => {
      if (!alive) return;
      setEntries(e);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [day]);

  // Compact (run-over modal): no skeleton, no offline box — only ever appear
  // once there are real standings to show.
  if (compact && (!loaded || entries === null)) return null;

  const wrap = compact
    ? 'rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/5 px-3 py-2.5'
    : 'rounded-xl border border-fuchsia-400/30 bg-pitch-900/70 p-4';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const header = (suffix: string) => (
    <p className={`mb-2 flex items-center gap-1.5 font-display uppercase tracking-wide text-fuchsia-200 ${textSize}`}>
      <Globe2 size={compact ? 13 : 16} />
      Daily Gauntlet · {day}{suffix}
    </p>
  );

  // Loading — a shimmer skeleton so the panel has presence while the fetch
  // resolves (non-compact only; compact returned null above).
  if (!loaded) {
    return (
      <div className={wrap} data-testid="daily-leaderboard-loading" aria-busy="true">
        {header('')}
        <ol className="space-y-1">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-2 px-2 py-1">
              <span className="h-3 w-4 shrink-0 rounded bg-white/10 motion-safe:animate-pulse" />
              <span
                className="h-3 flex-1 rounded bg-white/10 motion-safe:animate-pulse"
                style={{ maxWidth: `${68 - i * 9}%` }}
              />
              <span className="h-3 w-10 shrink-0 rounded bg-white/10 motion-safe:animate-pulse" />
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // Offline / unreachable backend — explain it instead of vanishing.
  if (entries === null) {
    return (
      <div className={wrap} data-testid="daily-leaderboard-offline">
        {header('')}
        <p className={`flex items-center gap-1.5 text-chrome-muted ${textSize}`}>
          <WifiOff size={compact ? 12 : 14} className="shrink-0" />
          Leaderboard needs a connection — reconnect to see today's world standings.
        </p>
      </div>
    );
  }

  const me = leaderboardId();
  const empty = entries.length === 0;

  return (
    <div className={wrap} data-testid="daily-leaderboard">
      {header(empty ? '' : ` · world top ${entries.length}`)}
      {empty && (
        <p className={`text-chrome-muted ${textSize}`}>
          No scores yet today — finish the Daily Gauntlet to be the first on the board.
        </p>
      )}
      <ol className="space-y-0.5">
        {entries.map((e, i) => {
          const mine = e.id === me;
          return (
            <li
              key={e.id}
              className={[
                'flex items-center gap-2 rounded px-2 py-0.5 font-ticker text-sm',
                mine ? 'bg-crt-green/15 text-crt-green' : i === 0 ? 'text-crt-amber' : 'text-chrome',
              ].join(' ')}
            >
              <span className="w-6 shrink-0 text-right text-chrome-muted">{i + 1}.</span>
              {i === 0 && <Crown size={12} className="shrink-0 text-crt-amber" />}
              <span className="min-w-0 flex-1 truncate font-display text-xs">
                {e.club}
                {mine && <span className="text-crt-green/70"> (you)</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatScore(e.score)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
