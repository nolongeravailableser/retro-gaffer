import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, RotateCcw, AlertTriangle, Crown, CalendarDays } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { bestLabel } from '@/lib/ladder';

/** Top bankroll readout, career best, run controls, and a notice toast. */
export default function Hud() {
  const bankroll = useGameStore((s) => s.bankroll);
  const best = useGameStore((s) => s.best);
  const daily = useGameStore((s) => s.daily);
  const notice = useGameStore((s) => s.notice);
  const clearNotice = useGameStore((s) => s.clearNotice);
  const newGame = useGameStore((s) => s.newGame);
  const newDailyRun = useGameStore((s) => s.newDailyRun);

  // Auto-dismiss the notice after a moment.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 2200);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  return (
    <div className="relative flex items-center justify-center gap-3">
      <motion.div
        key={bankroll}
        initial={{ scale: 1.12 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-2 rounded-lg border border-crt-amber/40 bg-pitch-900/80 px-4 py-2"
      >
        <Coins size={18} className="text-crt-amber" />
        <span className="font-display text-2xl text-crt-amber">£{bankroll}M</span>
      </motion.div>

      {best.round > 0 && (
        <div
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-pitch-900/80 px-3 py-2"
          title="Career-best division reached"
        >
          <Crown size={15} className="text-crt-green" />
          <span className="font-display text-sm text-chrome">{bestLabel(best.round)}</span>
        </div>
      )}

      {daily && (
        <div
          className="flex items-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2"
          title="Daily Challenge — deterministic for everyone today"
        >
          <CalendarDays size={15} className="text-fuchsia-300" />
          <span className="font-display text-sm text-fuchsia-200">Daily {daily}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (confirm('Start a new game? Your squad and bankroll reset.')) {
            newGame();
          }
        }}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-chrome-muted hover:text-chrome"
      >
        <RotateCcw size={13} />
        New Game
      </button>

      <button
        type="button"
        onClick={() => {
          if (confirm("Start today's Daily Challenge? Same draws & opponents for everyone today.")) {
            newDailyRun();
          }
        }}
        data-testid="daily-run"
        className="flex items-center gap-1.5 rounded-lg border border-fuchsia-400/30 px-3 py-2 text-xs text-fuchsia-200 hover:bg-fuchsia-500/10"
      >
        <CalendarDays size={13} />
        Daily
      </button>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
            className="absolute -bottom-11 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-sm text-rose-200"
          >
            <AlertTriangle size={14} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
