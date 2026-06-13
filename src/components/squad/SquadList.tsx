import {
  Ban, HeartCrack, MousePointerClick, GripVertical, Wand2, BatteryLow,
  Snowflake, Smile, Meh, Frown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { sharpnessBand, fatigueBand } from '@/lib/training';
import { morale as playerMorale, moraleBand, moraleLabel } from '@/lib/morale';
import { overall } from '@/lib/wages';
import { avgRating } from '@/lib/ratings';
import { Draggable } from '@/components/dnd/dnd';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { positionLabel } from '@/lib/playerMeta';
import OvrBadge from '@/components/ui/OvrBadge';
import SquadActions from '@/components/squad/SquadActions';
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
  const playerHistory = useGameStore((s) => s.playerHistory);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const openProfile = useGameStore((s) => s.openProfile);
  const clubName = useGameStore((s) => s.clubName);
  const inLeague = useGameStore((s) => s.league !== null);
  const sharpness = useGameStore((s) => s.sharpness);
  const fatigue = useGameStore((s) => s.fatigue);

  const onPitch = new Set(xi.filter((id): id is string => !!id));
  const onBench = new Set(bench);
  const suspendedSet = new Set(suspensions);
  const injuredMap = injuries as Record<string, number>;

  const byStatus = (id: string) => (onPitch.has(id) ? 0 : onBench.has(id) ? 1 : 2);
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
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-pitch-900/70">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-pitch-900/80 px-3 py-2">
        <span className="truncate font-display text-sm uppercase tracking-wide text-chrome">
          {clubName ?? 'Your Squad'}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <SquadActions />
          <span className="font-data text-xs text-chrome-muted">
            {onPitch.size}/11
          </span>
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
            <div className="flex items-center gap-2 border-b border-crt-green/30 bg-crt-green/10 px-3 py-1.5 text-xs text-crt-green">
              <MousePointerClick size={11} />
              <span>
                <span className="font-display">{selected.name}</span> — tap a slot to field him
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
            <div className="border-b border-white/5 px-3 py-1.5 text-[11px] text-chrome-muted">
              Tap a player for their profile; drag to a slot to field him.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Column labels */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1 font-data text-[9px] uppercase tracking-wider text-chrome-muted/70">
        <span className="w-3" />
        <span className="w-8">Role</span>
        <span className="flex-1">Player</span>
        <span className="w-11 text-right">Form</span>
        <span className="w-10 text-right">Chem</span>
        <span className="w-8 text-right">OVR</span>
      </div>

      {/* Empty squad — point new managers at the journey's first step */}
      {owned.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
          <Wand2 size={20} className="text-chrome-muted/60" />
          <p className="font-display text-sm text-chrome">No players signed yet</p>
          <p className="text-[11px] text-chrome-muted">
            Open the <span className="text-crt-amber">Market</span> tab (or hit{' '}
            <span className="text-crt-green">Sign players</span> above) to build your squad.
          </p>
        </div>
      )}

      {/* Groups */}
      <div className="flex-1 divide-y divide-white/5 overflow-y-auto">
        {groups.map((group) => {
          if (group.ids.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="bg-pitch-950/40 px-3 py-1 font-data text-[9px] uppercase tracking-widest text-chrome-muted">
                {group.label}
              </div>
              {group.ids.map((id) => {
                const p = getPlayer(id);
                if (!p) return null;
                const rs = ROLE_STYLES[p.role];
                const pos = positionLabel(p.position);
                const isSelected = id === selectedPlayerId;
                const isSuspended = suspendedSet.has(id);
                const injuredRounds = injuredMap[id];
                const unavailable = isSuspended || !!injuredRounds;
                const mult = onPitch.has(id) ? (multipliers.get(id) ?? 1) : 1;
                const chemBonus = mult > 1 ? Math.round((mult - 1) * 100) : 0;
                const h = playerHistory[id];
                const avg = h && h.apps > 0 ? avgRating(h) : null;
                const moodBand = inLeague
                  ? moraleBand(playerMorale(h ? avgRating(h) : null, sharpness[id]))
                  : null;
                const moods = {
                  unhappy: [Frown, 'text-rose-300'],
                  unsettled: [Meh, 'text-orange-300'],
                  buzzing: [Smile, 'text-crt-green'],
                } as const;
                const mood = moodBand ? moods[moodBand as keyof typeof moods] : undefined;

                return (
                  <div key={id}>
                    <div
                      onClick={() => openProfile(id)}
                      className={[
                        'flex cursor-pointer select-none items-center gap-2 px-3 py-2 transition-colors',
                        isSelected
                          ? 'border-l-2 border-crt-green bg-crt-green/10'
                          : 'border-l-2 border-transparent hover:bg-white/5',
                        unavailable ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      {/* Drag handle */}
                      <Draggable id={`squad:${id}`} playerId={id} className="shrink-0">
                        <GripVertical size={12} className="cursor-grab text-chrome-muted/40 hover:text-chrome-muted active:cursor-grabbing" />
                      </Draggable>

                      {/* Role pill */}
                      <span className={`w-8 shrink-0 rounded px-1 py-0.5 text-center font-data text-[10px] font-semibold ${rs.text} ${rs.bg}`}>
                        {p.role}
                      </span>

                      {/* Name + sub-line */}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[13px] leading-tight text-chrome">
                          {p.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-chrome-muted">
                          {pos && <span className="truncate">{pos}</span>}
                          {isSuspended && (
                            <span className="flex shrink-0 items-center gap-0.5 rounded bg-rose-500 px-1 font-data text-[8px] font-bold text-white">
                              <Ban size={7} /> BAN
                            </span>
                          )}
                          {injuredRounds && !isSuspended ? (
                            <span className="flex shrink-0 items-center gap-0.5 rounded bg-tier-low px-1 font-data text-[8px] font-bold text-pitch-950">
                              <HeartCrack size={7} /> INJ·{injuredRounds}
                            </span>
                          ) : null}
                          {inLeague && !unavailable && fatigueBand(fatigue[id]) === 'tired' && (
                            <span className="flex shrink-0 items-center gap-0.5 rounded bg-sky-300 px-1 font-data text-[8px] font-bold text-pitch-950" title="Tired — rest him to recover">
                              <BatteryLow size={7} /> TIRED
                            </span>
                          )}
                          {inLeague && !unavailable && sharpnessBand(sharpness[id]) === 'rusty' && (
                            <span className="flex shrink-0 items-center gap-0.5 rounded border border-sky-300/50 px-1 font-data text-[8px] font-bold text-sky-300" title="Match-rusty — needs games to sharpen up">
                              <Snowflake size={7} /> RUSTY
                            </span>
                          )}
                          {mood && (() => {
                            const [Icon, color] = mood;
                            return (
                              <span className="shrink-0" title={`Morale: ${moraleLabel(moodBand!)}`}>
                                <Icon size={10} className={color} />
                              </span>
                            );
                          })()}
                        </span>
                      </div>

                      {/* Form */}
                      <span className="w-11 shrink-0 text-right font-data text-[11px] text-chrome-muted">
                        {avg !== null ? <span className="text-crt-amber">★{avg.toFixed(1)}</span> : '—'}
                      </span>

                      {/* Chem */}
                      <span className="w-10 shrink-0 text-right font-data text-[11px]">
                        {chemBonus > 0 ? <span className="text-crt-green">+{chemBonus}%</span> : <span className="text-chrome-muted/50">—</span>}
                      </span>

                      {/* OVR */}
                      <OvrBadge value={overall(p)} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
