import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine,
  MousePointerClick,
  Coins,
  Users,
  Ban,
  HeartCrack,
} from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { sellValue } from '@/lib/economy';
import PlayerCard from '@/components/cards/PlayerCard';
import { Draggable } from '@/components/dnd/dnd';

interface SquadPanelProps {
  /** playerId → chemistry multiplier (1 = none). */
  multipliers: Map<string, number>;
}

/** The owned squad: assign to the pitch/bench or sell back for 80%. */
export default function SquadPanel({ multipliers }: SquadPanelProps) {
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const bench = useGameStore((s) => s.bench);
  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const selectPlayer = useGameStore((s) => s.selectPlayer);
  const sendToBench = useGameStore((s) => s.sendToBench);
  const sell = useGameStore((s) => s.sell);

  const onPitch = new Set(xi.filter((id): id is string => !!id));
  const onBench = new Set(bench);
  const suspendedSet = new Set(suspensions);
  const injuredMap = injuries as Record<string, number>;
  const selected = getPlayer(selectedPlayerId);

  const statusFor = (id: string) =>
    onPitch.has(id) ? 'On pitch' : onBench.has(id) ? 'Bench' : 'Reserve';

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl">
        <Users size={18} /> Your Squad
      </h2>

      <AnimatePresence initial={false}>
        {selected ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-crt-green/40 bg-crt-green/10 px-3 py-2"
          >
            <span className="text-sm">
              <span className="font-display text-crt-green">{selected.name}</span>{' '}
              <span className="text-chrome-muted">
                picked up — tap a green {selected.role} slot
              </span>
            </span>
            <button
              type="button"
              onClick={() => sendToBench(selected.id)}
              className="flex shrink-0 items-center gap-1 rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
            >
              <ArrowDownToLine size={12} />
              Bench
            </button>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-3 flex items-center gap-1.5 text-xs text-chrome-muted"
          >
            <MousePointerClick size={13} />
            Buy from the market, then tap a player to assign them.
          </motion.p>
        )}
      </AnimatePresence>

      {owned.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-chrome-muted">
          No players yet — sign someone from the Transfer Market above.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {owned.map((id) => {
              const p = getPlayer(id);
              if (!p) return null;
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative"
                >
                  <Draggable id={`squad:${id}`} playerId={id}>
                    <PlayerCard
                      player={p}
                      selected={id === selectedPlayerId}
                      multiplier={onPitch.has(id) ? multipliers.get(id) ?? 1 : 1}
                      status={statusFor(id)}
                      onClick={() => selectPlayer(id)}
                    />
                  </Draggable>

                  {/* Suspension badge */}
                  {suspendedSet.has(id) && (
                    <span className="absolute -left-2 -top-2 flex items-center gap-0.5 rounded-full border border-red-400/60 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-display text-red-300">
                      <Ban size={10} /> BAN
                    </span>
                  )}

                  {/* Injury badge */}
                  {injuredMap[id] && !suspendedSet.has(id) && (
                    <span className="absolute -left-2 -top-2 flex items-center gap-0.5 rounded-full border border-orange-400/60 bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-display text-orange-300">
                      <HeartCrack size={10} /> {injuredMap[id]}R
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => sell(id)}
                    data-testid={`sell-${id}`}
                    aria-label={`Sell ${p.name} for £${sellValue(p)}M`}
                    className="absolute -right-2 -top-2 flex items-center gap-0.5 rounded-full border border-white/20 bg-pitch-950 px-1.5 py-0.5 text-[10px] text-chrome-muted hover:text-crt-amber"
                  >
                    <Coins size={10} />
                    {sellValue(p)}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
