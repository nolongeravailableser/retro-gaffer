import { Ban, HeartCrack, CircleCheck } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';

interface AvailabilityStripProps {
  /** Hide entirely when everyone is fit, instead of showing the "all available" note. */
  hideWhenClear?: boolean;
}

/**
 * Roster availability at a glance: who's suspended or injured and for how long.
 * Surfaces mechanics the engine already tracks but the UI previously hid.
 */
export default function AvailabilityStrip({ hideWhenClear }: AvailabilityStripProps) {
  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);

  const suspended = suspensions
    .map((id) => getPlayer(id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const injured = Object.entries(injuries)
    .map(([id, rounds]) => ({ player: getPlayer(id), rounds }))
    .filter((x): x is { player: NonNullable<ReturnType<typeof getPlayer>>; rounds: number } => !!x.player);

  const total = suspended.length + injured.length;

  if (total === 0) {
    if (hideWhenClear) return null;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-pitch-900/70 px-3 py-2 text-xs text-chrome-muted">
        <CircleCheck size={14} className="text-crt-green" />
        Full squad available — no suspensions or injuries.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 px-3 py-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-display uppercase tracking-wide text-amber-300">
        {total} unavailable next match
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suspended.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200"
          >
            <Ban size={11} />
            <span className="font-display">{p.name}</span>
            <span className="text-rose-300/70">ban</span>
          </span>
        ))}
        {injured.map(({ player, rounds }) => (
          <span
            key={player.id}
            className="flex items-center gap-1 rounded-md border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-200"
          >
            <HeartCrack size={11} />
            <span className="font-display">{player.name}</span>
            <span className="text-orange-300/70">{rounds}R</span>
          </span>
        ))}
      </div>
    </div>
  );
}
