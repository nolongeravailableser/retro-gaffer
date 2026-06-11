import { ListOrdered } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { table, totalWeeks, YOU } from '@/lib/league';

/** The live league standings for an active League Season (you highlighted). */
export default function LeagueTable() {
  const league = useGameStore((s) => s.league);
  const clubName = useGameStore((s) => s.clubName);
  if (!league) return null;

  const rows = table(league);
  const weeks = totalWeeks(league);
  const played = Math.min(league.matchweek - 1, weeks);

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-3" data-testid="league-table">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-display text-sm uppercase tracking-wide text-chrome">
          <ListOrdered size={15} /> League Table
        </span>
        <span className="font-ticker text-xs text-chrome-muted">
          Matchweek {Math.min(league.matchweek, weeks)}/{weeks}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right font-ticker text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-chrome-muted">
              <th className="py-1 pr-1 text-left">#</th>
              <th className="py-1 text-left">Club</th>
              <th className="px-1">P</th>
              <th className="px-1">W</th>
              <th className="px-1">D</th>
              <th className="px-1">L</th>
              <th className="px-1">GD</th>
              <th className="px-1 font-display text-chrome">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isYou = r.teamId === YOU;
              return (
                <tr
                  key={r.teamId}
                  className={[
                    'border-t border-white/5',
                    isYou ? 'bg-crt-green/15 text-crt-green' : i === 0 ? 'text-crt-amber' : 'text-chrome',
                  ].join(' ')}
                >
                  <td className="py-1 pr-1 text-left text-chrome-muted">{i + 1}</td>
                  <td className="py-1 text-left font-display">
                    {isYou ? clubName ?? 'Your XI' : r.name}
                  </td>
                  <td className="px-1 tabular-nums">{r.played}</td>
                  <td className="px-1 tabular-nums">{r.won}</td>
                  <td className="px-1 tabular-nums">{r.drawn}</td>
                  <td className="px-1 tabular-nums">{r.lost}</td>
                  <td className="px-1 tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="px-1 font-display tabular-nums">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-chrome-muted">
        {played === 0
          ? 'Single round-robin — win the title to be champions.'
          : `${played} of ${weeks} matchweeks played.`}
      </p>
    </div>
  );
}
