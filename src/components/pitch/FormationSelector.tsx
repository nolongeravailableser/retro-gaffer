import { LayoutGrid } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { FORMATION_IDS, FORMATIONS } from '@/lib/formations';

/** Pick the active formation. Switching re-slots players by role. */
export default function FormationSelector() {
  const formation = useGameStore((s) => s.formation);
  const setFormation = useGameStore((s) => s.setFormation);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-chrome-muted">
        <LayoutGrid size={14} /> Formation
      </span>
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/10 bg-pitch-900/70 p-1">
        {FORMATION_IDS.map((id) => {
          const active = id === formation;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFormation(id)}
              data-testid={`formation-${id}`}
              aria-pressed={active}
              className={[
                'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 font-display text-sm transition',
                active
                  ? 'bg-crt-green/20 text-crt-green shadow-glow'
                  : 'text-chrome-muted hover:text-chrome hover:bg-white/5',
              ].join(' ')}
            >
              {FORMATIONS[id].name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
