import { Trophy } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { cupTies, cupTieKey, roundName } from '@/lib/cup';

/**
 * The Cup bracket (Season tab) — your knockout path round by round, with results
 * and the surviving field. Reads the live cup state from the store.
 */
export default function CupBracket() {
  const cup = useGameStore((s) => s.cup);
  const clubName = useGameStore((s) => s.clubName);
  if (!cup) return null;

  const nameOf = (id: string) =>
    id === 'YOU' ? clubName ?? 'Your XI' : cup.clubs.find((c) => c.id === id)?.name ?? id;

  // Show the current round's ties (live), plus a compact "rounds" progress strip.
  const ties = cupTies(cup);

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4" data-testid="cup-bracket">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={18} className="text-crt-amber" />
        <h2 className="font-display text-xl">Cup</h2>
        <span className="ml-auto font-ticker text-[11px] text-chrome-muted">
          {roundName(cup.round, cup.rounds)} · {cup.alive.length} left
        </span>
      </div>

      {/* Round progress dots */}
      <div className="mb-3 flex items-center gap-1.5">
        {Array.from({ length: cup.rounds }, (_, i) => i + 1).map((r) => (
          <span
            key={r}
            className={[
              'flex-1 rounded-full py-1 text-center font-display text-[10px]',
              r < cup.round
                ? 'bg-crt-green/20 text-crt-green'
                : r === cup.round
                  ? 'bg-crt-amber/20 text-crt-amber'
                  : 'bg-white/5 text-chrome-muted',
            ].join(' ')}
          >
            {roundName(r, cup.rounds)}
          </span>
        ))}
      </div>

      {/* This round's ties */}
      <div className="flex flex-col gap-1.5">
        {ties.map((t) => {
          const res = cup.results[cupTieKey(t.round, t.home, t.away)];
          const isYours = t.home === 'YOU' || t.away === 'YOU';
          return (
            <div
              key={`${t.home}-${t.away}`}
              className={[
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 font-ticker text-xs',
                isYours ? 'border-crt-green/40 bg-crt-green/5' : 'border-white/10 bg-pitch-950/40',
              ].join(' ')}
            >
              <span className="flex-1 truncate text-right text-chrome">{nameOf(t.home)}</span>
              <span className="shrink-0 font-display text-chrome-muted">
                {res ? `${res.home}–${res.away}` : 'vs'}
              </span>
              <span className="flex-1 truncate text-chrome">{nameOf(t.away)}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 font-ticker text-[11px] text-chrome-muted">
        Single elimination — win your tie to advance, lose and you’re out. Lift the trophy by winning
        the {roundName(cup.rounds, cup.rounds)}.
      </p>
    </div>
  );
}
