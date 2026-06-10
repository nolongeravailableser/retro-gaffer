import { Search, Coins } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { SCOUT_BRIEFS } from '@/lib/scouting';

/** Scout Discovery Network: dispatch a paid scout to guarantee a target type. */
export default function ScoutPanel() {
  const bankroll = useGameStore((s) => s.bankroll);
  const scoutShop = useGameStore((s) => s.scoutShop);

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Search size={16} className="text-crt-green" />
        <h2 className="font-display text-lg">Scout Network</h2>
      </div>
      <p className="mb-3 text-[11px] text-chrome-muted">
        Brief a scout to guarantee a matching player in the next shop — intentional
        discovery instead of luck. Casts a wide net (All-Stars).
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SCOUT_BRIEFS.map((b) => {
          const affordable = bankroll >= b.cost;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => scoutShop(b.id)}
              disabled={!affordable}
              data-testid={`scout-${b.id}`}
              title={b.blurb}
              className={[
                'flex flex-col gap-0.5 rounded-lg border p-2 text-left transition',
                affordable
                  ? 'border-white/10 hover:border-crt-green/50 hover:bg-crt-green/5'
                  : 'cursor-not-allowed border-white/5 opacity-40',
              ].join(' ')}
            >
              <span className="flex items-center gap-1.5 font-display text-xs text-chrome">
                <span>{b.emoji}</span>
                {b.label}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-crt-amber">
                <Coins size={9} />£{b.cost}M
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
