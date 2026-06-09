import { Coins, Ban, HeartCrack, MousePointerClick, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { sellValue } from '@/lib/economy';
import { Draggable } from '@/components/dnd/dnd';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { positionLabel } from '@/lib/playerMeta';
import StatBar from '@/components/ui/StatBar';
import type { Role } from '@/lib/types';

interface SquadListProps {
  multipliers: Map<string, number>;
}

const ROLE_ORDER: Role[] = ['GK', 'DEF', 'MID', 'FWD'];

export default function SquadList({ multipliers }: SquadListProps) {
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const bench = useGameStore((s) => s.bench);
  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const selectPlayer = useGameStore((s) => s.selectPlayer);
  const sell = useGameStore((s) => s.sell);

  const onPitch = new Set(xi.filter((id): id is string => !!id));
  const onBench = new Set(bench);
  const suspendedSet = new Set(suspensions);
  const injuredMap = injuries as Record<string, number>;

  const byStatus = (id: string) =>
    onPitch.has(id) ? 0 : onBench.has(id) ? 1 : 2;

  const sortKey = (id: string) => {
    const p = getPlayer(id);
    return `${byStatus(id)}-${ROLE_ORDER.indexOf(p?.role as Role)}-${p?.name}`;
  };

  const groups: { label: string; ids: string[] }[] = [
    { label: 'Starting XI', ids: [] },
    { label: 'Bench', ids: [] },
    { label: 'Reserves', ids: [] },
  ];

  [...owned].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).forEach((id) => {
    groups[byStatus(id)].ids.push(id);
  });

  const selected = getPlayer(selectedPlayerId);

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-pitch-900/70 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-pitch-900/80">
        <span className="font-display text-sm uppercase tracking-wide text-chrome">
          Your Squad
        </span>
        <span className="font-ticker text-xs text-chrome-muted">
          {onPitch.size}/11 · {owned.length} owned
        </span>
      </div>

      {/* Selected-player hint */}
      <AnimatePresence initial={false}>
        {selected ? (
          <motion.div
            key="sel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 bg-crt-green/10 border-b border-crt-green/30 text-xs text-crt-green">
              <MousePointerClick size={11} />
              <span>
                <span className="font-display">{selected.name}</span> — tap a{' '}
                {selected.role} slot on the pitch
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="hint"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-white/5 text-[11px] text-chrome-muted">
              Tap a player to select, then tap a pitch slot to assign.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Column labels */}
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-x-2 px-2 py-1 border-b border-white/10 text-[10px] uppercase tracking-wide text-chrome-muted">
        <span className="w-3" />
        <span className="w-8" />
        <span>Name</span>
        <span className="w-[5.5rem] text-center">Ratings</span>
        <span className="w-12 text-right">Value</span>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {groups.map((group) => {
          if (group.ids.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="px-3 py-1 bg-pitch-950/40 text-[10px] font-display uppercase tracking-wide text-chrome-muted">
                {group.label}
              </div>
              {group.ids.map((id) => {
                const p = getPlayer(id);
                if (!p) return null;
                const role = p.role;
                const rs = ROLE_STYLES[role];
                const pos = positionLabel(p.position);
                const isSelected = id === selectedPlayerId;
                const isSuspended = suspendedSet.has(id);
                const injuredRounds = injuredMap[id];
                const unavailable = isSuspended || !!injuredRounds;
                const mult = onPitch.has(id) ? (multipliers.get(id) ?? 1) : 1;
                const chemBonus = mult > 1 ? Math.round((mult - 1) * 100) : 0;

                return (
                  <div
                    key={id}
                    onClick={() => selectPlayer(id)}
                    className={[
                      'grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-x-2 px-2 py-1.5 cursor-pointer transition-colors select-none',
                      isSelected
                        ? 'bg-crt-green/10 border-l-2 border-crt-green'
                        : 'border-l-2 border-transparent hover:bg-white/5',
                      unavailable ? 'opacity-55' : '',
                    ].join(' ')}
                  >
                      {/* Drag handle */}
                      <Draggable id={`squad:${id}`} playerId={id} className="shrink-0">
                        <GripVertical size={12} className="text-chrome-muted/40 hover:text-chrome-muted cursor-grab active:cursor-grabbing" />
                      </Draggable>

                      {/* Role pill */}
                      <span
                        className={`w-8 shrink-0 text-center text-[10px] font-display px-1 py-0.5 rounded ${rs.text} ${rs.bg} ${rs.border} border`}
                      >
                        {role}
                      </span>

                      {/* Name + position + badges */}
                      <div className="min-w-0">
                        <span className="font-display text-xs text-chrome truncate block">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {pos && (
                            <span className="text-[9px] text-chrome-muted/70 truncate">
                              {pos}
                            </span>
                          )}
                          {chemBonus > 0 && (
                            <span className="text-[9px] text-crt-green font-display shrink-0">
                              ✦+{chemBonus}%
                            </span>
                          )}
                          {isSuspended && (
                            <span className="flex items-center gap-0.5 text-[9px] text-rose-300 font-display shrink-0">
                              <Ban size={8} /> BAN
                            </span>
                          )}
                          {injuredRounds && !isSuspended && (
                            <span className="flex items-center gap-0.5 text-[9px] text-orange-300 font-display shrink-0">
                              <HeartCrack size={8} /> {injuredRounds}R
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rated stats */}
                      <div className="w-[5.5rem] flex flex-col gap-0.5">
                        <StatBar label="ATK" value={p.stats.attack} labelClass="text-rose-300/70" compact />
                        <StatBar label="DEF" value={p.stats.defense} labelClass="text-sky-300/70" compact />
                      </div>

                      {/* Sell */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); sell(id); }}
                        aria-label={`Sell ${p.name}`}
                        className="w-12 flex items-center justify-end gap-0.5 text-[10px] text-chrome-muted hover:text-crt-amber transition-colors"
                      >
                        <Coins size={9} />
                        {sellValue(p)}M
                      </button>
                  </div>
                );
              })}
            </div>
          );
        })}

        {owned.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-chrome-muted">
            No players — sign someone from the Transfer Market.
          </p>
        )}
      </div>
    </div>
  );
}
