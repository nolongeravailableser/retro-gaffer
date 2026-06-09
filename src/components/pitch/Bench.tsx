import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { BENCH_SIZE } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { Draggable, Droppable } from '@/components/dnd/dnd';

/** Substitutes bench (max BENCH_SIZE). Also a drop target. */
export default function Bench() {
  const bench = useGameStore((s) => s.bench);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const selectPlayer = useGameStore((s) => s.selectPlayer);
  const removeFromBench = useGameStore((s) => s.removeFromBench);

  return (
    <Droppable
      id="bench"
      className="rounded-xl border border-white/10 bg-pitch-900/60 p-3 data-[over=true]:border-crt-green/60 data-[over=true]:bg-crt-green/5"
    >
      <p className="mb-2 text-xs uppercase tracking-wide text-chrome-muted">
        Bench {bench.length}/{BENCH_SIZE} · drag here to sub
      </p>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {bench.map((id) => {
            const p = getPlayer(id);
            if (!p) return null;
            const style = ROLE_STYLES[p.role];
            const selected = id === selectedPlayerId;
            return (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative"
              >
                <Draggable id={`bench:${id}`} playerId={id}>
                  <button
                    type="button"
                    onClick={() => selectPlayer(id)}
                    aria-pressed={selected}
                    className={[
                      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition',
                      selected
                        ? 'border-crt-green ring-2 ring-crt-green/60'
                        : 'border-white/10 bg-pitch-800/70',
                    ].join(' ')}
                  >
                    <span
                      className={`rounded border px-1 text-[10px] font-display ${style.text} ${style.border}`}
                    >
                      {p.role}
                    </span>
                    <span className="font-display text-sm">{p.name}</span>
                  </button>
                </Draggable>
                <button
                  type="button"
                  onClick={() => removeFromBench(id)}
                  aria-label={`Remove ${p.name} from bench`}
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-pitch-950 text-chrome-muted hover:text-rose-300"
                >
                  <X size={12} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {bench.length === 0 && (
          <p className="px-1 py-1.5 text-sm text-chrome-muted">
            Empty — drag a player here, or pick one and tap “Bench”.
          </p>
        )}
      </div>
    </Droppable>
  );
}
