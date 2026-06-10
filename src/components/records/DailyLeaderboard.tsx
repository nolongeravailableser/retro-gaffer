import { useEffect, useState } from 'react';
import { Globe2, Crown } from 'lucide-react';
import { fetchDailyTop, leaderboardId, type LeaderboardEntry } from '@/lib/leaderboard';
import { formatScore } from '@/lib/score';

interface DailyLeaderboardProps {
  /** Date key of the board to show (e.g. today's, or a finished run's day). */
  day: string;
  /** Compact mode for embedding in the run-over modal. */
  compact?: boolean;
}

/**
 * Today's global Daily Gauntlet standings. Renders NOTHING while the backend
 * is unavailable (not provisioned / offline / dev server) — the leaderboard is
 * an enhancement, never a broken box.
 */
export default function DailyLeaderboard({ day, compact = false }: DailyLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    void fetchDailyTop(day).then((e) => {
      if (!alive) return;
      setEntries(e);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [day]);

  // entries === null → backend offline/unprovisioned: hide entirely.
  // entries === []   → backend live but no scores yet today: show an inviting
  //                    empty state so the board never looks broken once it's up.
  if (!loaded || entries === null) return null;

  const me = leaderboardId();
  const empty = entries.length === 0;

  return (
    <div
      className={
        compact
          ? 'rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/5 px-3 py-2.5'
          : 'rounded-xl border border-fuchsia-400/30 bg-pitch-900/70 p-4'
      }
      data-testid="daily-leaderboard"
    >
      <p className={`mb-2 flex items-center gap-1.5 font-display uppercase tracking-wide text-fuchsia-200 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Globe2 size={compact ? 13 : 16} />
        Daily Gauntlet · {day}{empty ? '' : ` · world top ${entries.length}`}
      </p>
      {empty && (
        <p className={`text-chrome-muted ${compact ? 'text-xs' : 'text-sm'}`}>
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
