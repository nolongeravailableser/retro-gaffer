import { Wand2, Eraser } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';

/**
 * Auto-Pick / Clear one-tap helpers. Fields the strongest available XI
 * (chemistry-aware, skips banned/injured) or clears the pitch back to the squad.
 * Shared so the controls are reachable both on the squad list AND on the
 * pitch/formation view (R7 — you shouldn't have to find the list to fill an XI).
 * `idSuffix` keeps the data-testids unique when both copies are mounted at once
 * (desktop two-column).
 */
export default function SquadActions({ idSuffix = '' }: { idSuffix?: string }) {
  const autoPickXI = useGameStore((s) => s.autoPickXI);
  const benchAll = useGameStore((s) => s.benchAll);
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const onPitch = xi.filter(Boolean).length;

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={autoPickXI}
        disabled={owned.length === 0}
        data-testid={`auto-pick${idSuffix}`}
        title="Field your strongest available XI (chemistry-aware; skips banned/injured players)"
        className="flex items-center gap-1 rounded-md border border-crt-green/40 bg-crt-green/10 px-2 py-1 font-display text-[11px] text-crt-green transition hover:bg-crt-green/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Wand2 size={12} /> Auto-Pick
      </button>
      <button
        type="button"
        onClick={benchAll}
        disabled={onPitch === 0}
        data-testid={`clear-squad${idSuffix}`}
        title="Clear the pitch — send every starter back to the squad"
        className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 font-display text-[11px] text-chrome-muted transition hover:bg-white/5 hover:text-chrome disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Eraser size={12} /> Clear
      </button>
    </span>
  );
}
