import { useState } from 'react';
import {
  Ban, HeartCrack, MousePointerClick, GripVertical, Wand2, Eraser, BatteryLow,
  Snowflake, Smile, Meh, Frown, ArrowDownToLine,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { sellValue } from '@/lib/economy';
import { marketSellValue } from '@/lib/market';
import { sharpnessBand, fatigueBand } from '@/lib/training';
import { morale as playerMorale, moraleBand, moraleLabel } from '@/lib/morale';
import { LEAGUE_NEUTRAL_TIER, overall } from '@/lib/wages';
import { avgRating } from '@/lib/ratings';
import { deriveStats, STAT_LABELS, type ExtendedStatKey } from '@/lib/stats';
import { Draggable } from '@/components/dnd/dnd';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { positionLabel } from '@/lib/playerMeta';
import OvrBadge from '@/components/ui/OvrBadge';
import type { Player, Role } from '@/lib/types';

interface SquadListProps {
  multipliers: Map<string, number>;
}

const ROLE_ORDER: Role[] = ['GK', 'DEF', 'MID', 'FWD'];

/** Tier colour for a 0–99 sub-stat (text + bar fill). */
const statColor = (v: number) =>
  v >= 80 ? 'text-tier-elite' : v >= 65 ? 'text-tier-ok' : v >= 50 ? 'text-tier-low' : 'text-tier-poor';
const statFill = (v: number) =>
  v >= 80 ? 'bg-tier-elite' : v >= 65 ? 'bg-tier-ok' : v >= 50 ? 'bg-tier-low' : 'bg-tier-poor';

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-8 shrink-0 font-data text-[9px] uppercase text-chrome-muted/70">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${statFill(value)}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`w-6 shrink-0 text-right font-data text-[11px] tabular-nums ${statColor(value)}`}>{value}</span>
    </div>
  );
}

/** The expanded detail sheet for the selected player — full stats, history,
 *  and the actions (bench / sell) that used to crowd every row. */
function PlayerSheet({
  p, onPitch, chemBonus, saleValue,
}: {
  p: Player;
  onPitch: boolean;
  chemBonus: number;
  saleValue: number;
}) {
  const sendToBench = useGameStore((s) => s.sendToBench);
  const sell = useGameStore((s) => s.sell);
  const playerHistory = useGameStore((s) => s.playerHistory);
  const [confirmSell, setConfirmSell] = useState(false);
  const ext = deriveStats(p);
  const h = playerHistory[p.id];
  const avg = h ? avgRating(h) : null;
  const keys: ExtendedStatKey[] =
    p.role === 'GK' ? ['goalkeeping', 'defending', 'passing', 'physical', 'composure', 'discipline']
      : ['pace', 'shooting', 'passing', 'defending', 'physical', 'composure'];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.16 }}
      className="overflow-hidden"
    >
      <div className="border-b border-crt-green/20 bg-surface-2 px-3 py-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 text-[11px] text-chrome-muted">
            <p>
              {p.club && <span className="text-chrome">{p.club}</span>}
              {p.era && <span> · {p.era}</span>}
              {p.nationality && <span> · {p.nationality}</span>}
            </p>
            {chemBonus > 0 && <p className="text-crt-green">✦ chemistry +{chemBonus}% in this XI</p>}
          </div>
          <OvrBadge value={overall(p)} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <StatLine label="ATK" value={p.stats.attack} />
          <StatLine label="DEF" value={p.stats.defense} />
          {keys.map((k) => (
            <StatLine key={k} label={STAT_LABELS[k]} value={ext[k]} />
          ))}
        </div>

        {h && h.apps > 0 && (
          <p className="mt-2 font-data text-[11px] text-chrome-muted">
            This run: {h.apps} app{h.apps !== 1 ? 's' : ''}
            {avg !== null && <span className="text-crt-amber"> · ★{avg.toFixed(1)}</span>}
            {h.goals > 0 && <span className="text-crt-green"> · {h.goals}⚽</span>}
            {h.assists > 0 && <span className="text-sky-300"> · {h.assists}🅰</span>}
            {h.motm > 0 && <span className="text-crt-amber"> · {h.motm}× MOTM</span>}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          {onPitch ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); sendToBench(p.id); }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 py-1.5 font-display text-xs text-chrome hover:bg-white/5"
            >
              <ArrowDownToLine size={12} /> To bench
            </button>
          ) : (
            <span className="flex-1 text-center text-[11px] text-chrome-muted">
              Tap a pitch slot to field him
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirmSell) sell(p.id);
              else setConfirmSell(true);
            }}
            data-testid={`sell-${p.id}`}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 font-display text-xs transition',
              confirmSell
                ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                : 'border-rose-400/30 text-rose-300/90 hover:bg-rose-500/10',
            ].join(' ')}
          >
            {confirmSell ? 'Sure? Tap to sell' : `Sell · £${saleValue}M`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SquadList({ multipliers }: SquadListProps) {
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const bench = useGameStore((s) => s.bench);
  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);
  const playerHistory = useGameStore((s) => s.playerHistory);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const selectPlayer = useGameStore((s) => s.selectPlayer);
  const clubName = useGameStore((s) => s.clubName);
  const careerTier = useGameStore((s) => s.career?.tier ?? null);
  const inLeague = useGameStore((s) => s.league !== null);
  const sharpness = useGameStore((s) => s.sharpness);
  const fatigue = useGameStore((s) => s.fatigue);
  const autoPickXI = useGameStore((s) => s.autoPickXI);
  const benchAll = useGameStore((s) => s.benchAll);

  // Career/League sell at market value (free agents fetch nothing); else 80% of cost.
  const saleValue = (p: Player) => {
    if (careerTier !== null) return marketSellValue(p, careerTier);
    if (inLeague) return marketSellValue(p, LEAGUE_NEUTRAL_TIER);
    return sellValue(p);
  };

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
          <button
            type="button"
            onClick={autoPickXI}
            disabled={owned.length === 0}
            data-testid="auto-pick"
            title="Field your strongest available XI (chemistry-aware; skips banned/injured players)"
            className="flex items-center gap-1 rounded-md border border-crt-green/40 bg-crt-green/10 px-2 py-1 font-display text-[11px] text-crt-green transition hover:bg-crt-green/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Wand2 size={12} /> Auto-Pick
          </button>
          <button
            type="button"
            onClick={benchAll}
            disabled={onPitch.size === 0}
            data-testid="clear-squad"
            title="Clear the pitch — send every starter back to the squad"
            className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 font-display text-[11px] text-chrome-muted transition hover:bg-white/5 hover:text-chrome disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eraser size={12} /> Clear
          </button>
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
                <span className="font-display">{selected.name}</span> — tap a slot to place,
                or use the actions below
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
              Tap a player for details &amp; placement; drag to a slot also works.
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
                      onClick={() => selectPlayer(isSelected ? null : id)}
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

                    {/* Detail sheet under the selected row */}
                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <PlayerSheet
                          p={p}
                          onPitch={onPitch.has(id)}
                          chemBonus={chemBonus}
                          saleValue={saleValue(p)}
                        />
                      )}
                    </AnimatePresence>
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
