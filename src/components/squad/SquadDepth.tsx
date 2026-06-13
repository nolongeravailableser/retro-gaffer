import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, AlertTriangle, Check } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { squadDepth, type DepthStatus } from '@/lib/depth';
import { overall } from '@/lib/wages';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import type { Player } from '@/lib/types';

const STATUS: Record<DepthStatus, { cls: string; Icon: typeof Check }> = {
  ok: { cls: 'text-crt-green', Icon: Check },
  thin: { cls: 'text-crt-amber', Icon: AlertTriangle },
  short: { cls: 'text-rose-300', Icon: ShieldAlert },
};

/**
 * Depth chart — per-role health for the current formation: who starts, who's
 * cover, and where the squad is thin. A planning lens over the existing squad,
 * so a weak spot is visible before a suspension exposes it.
 */
export default function SquadDepth() {
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const formation = useGameStore((s) => s.formation);
  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);
  const openProfile = useGameStore((s) => s.openProfile);
  const [open, setOpen] = useState(false);

  if (owned.length === 0) return null;

  const players = owned.map(getPlayer).filter((p): p is Player => !!p);
  const unavailable = new Set<string>([...suspensions, ...Object.keys(injuries)]);
  const starters = new Set(xi.filter((id): id is string => !!id));
  const depth = squadDepth(players, unavailable, formation);
  const weakSpots = depth.filter((d) => d.status !== 'ok').length;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-pitch-900/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-display text-sm uppercase tracking-wide text-chrome">Depth</span>
        <span className="flex items-center gap-2">
          {weakSpots > 0 ? (
            <span className="flex items-center gap-1 font-data text-[11px] text-crt-amber">
              <AlertTriangle size={12} /> {weakSpots} thin
            </span>
          ) : (
            <span className="flex items-center gap-1 font-data text-[11px] text-crt-green">
              <Check size={12} /> well stocked
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-chrome-muted" /> : <ChevronDown size={14} className="text-chrome-muted" />}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-white/5 border-t border-white/10">
          {depth.map((d) => {
            const rs = ROLE_STYLES[d.role];
            const { cls, Icon } = STATUS[d.status];
            return (
              <div key={d.role} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`w-8 shrink-0 rounded px-1 py-0.5 text-center font-data text-[10px] font-semibold ${rs.text} ${rs.bg}`}>
                    {d.role}
                  </span>
                  <span className="font-data text-[11px] text-chrome-muted">
                    {d.fieldable}/{d.needed} fit
                  </span>
                  <span className={`ml-auto flex items-center gap-1 font-data text-[10px] ${cls}`}>
                    <Icon size={11} /> {d.note}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {d.players.map((p) => {
                    const start = starters.has(p.id);
                    const out = unavailable.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openProfile(p.id)}
                        title={`${p.name} · OVR ${overall(p)}${start ? ' · starting' : ''}${out ? ' · unavailable' : ''}`}
                        className={[
                          'flex items-center gap-1 rounded border px-1.5 py-0.5 font-data text-[10px] transition',
                          out
                            ? 'border-rose-400/40 text-rose-300/70 line-through'
                            : start
                              ? 'border-crt-green/50 bg-crt-green/10 text-chrome'
                              : 'border-white/10 text-chrome-muted hover:bg-white/5',
                        ].join(' ')}
                      >
                        <span className="max-w-[7rem] truncate">{p.name.split(' ').slice(-1)[0]}</span>
                        <span className="text-chrome-muted/70">{overall(p)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
