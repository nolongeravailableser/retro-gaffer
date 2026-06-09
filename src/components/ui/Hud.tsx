import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, RotateCcw, AlertTriangle, Crown, CalendarDays, Check, X, Heart, Flame } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { bestLabel, MAX_ROUNDS, STARTING_LIVES } from '@/lib/ladder';

/** Top bankroll readout, career best, run controls, and a notice toast. */
export default function Hud() {
  const bankroll = useGameStore((s) => s.bankroll);
  const best = useGameStore((s) => s.best);
  const daily = useGameStore((s) => s.daily);
  const round = useGameStore((s) => s.round);
  const lives = useGameStore((s) => s.lives);
  const streak = useGameStore((s) => s.streak);
  const runStatus = useGameStore((s) => s.runStatus);
  const notice = useGameStore((s) => s.notice);
  const clearNotice = useGameStore((s) => s.clearNotice);
  const newGame = useGameStore((s) => s.newGame);
  const newDailyRun = useGameStore((s) => s.newDailyRun);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmDaily, setConfirmDaily] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss the notice after a moment.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 2200);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  // Close confirm popover on outside click.
  useEffect(() => {
    if (!confirmNew && !confirmDaily) return;
    const handler = (e: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmNew(false);
        setConfirmDaily(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirmNew, confirmDaily]);

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <motion.div
        key={bankroll}
        initial={{ scale: 1.12 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-2 rounded-lg border border-crt-amber/40 bg-pitch-900/80 px-4 py-2"
      >
        <Coins size={18} className="text-crt-amber" />
        <span className="font-display text-2xl text-crt-amber">£{bankroll}M</span>
      </motion.div>

      {/* Run status — round / lives / streak, persistent across tabs */}
      {runStatus === 'playing' && (
        <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-pitch-900/80 px-3 py-2">
          <span className="font-display text-sm text-chrome">
            R{round}<span className="text-chrome-muted">/{MAX_ROUNDS}</span>
          </span>
          <span className="flex items-center gap-0.5" aria-label={`${lives} lives`}>
            {Array.from({ length: Math.max(STARTING_LIVES, lives) }, (_, i) => (
              <Heart
                key={i}
                size={12}
                className={i < lives ? 'fill-rose-400 text-rose-400' : 'text-white/15'}
              />
            ))}
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-0.5 font-display text-sm text-crt-amber">
              <Flame size={13} />
              {streak}
            </span>
          )}
        </div>
      )}

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

      {/* New Game button with popover confirm */}
      <div className="relative" ref={confirmNew ? confirmRef : undefined}>
        <button
          type="button"
          onClick={() => { setConfirmNew((v) => !v); setConfirmDaily(false); }}
          className={[
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition',
            confirmNew
              ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
              : 'border-white/10 text-chrome-muted hover:text-chrome',
          ].join(' ')}
        >
          <RotateCcw size={13} />
          New Game
        </button>
        <AnimatePresence>
          {confirmNew && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-400/40 bg-pitch-950 px-3 py-2 shadow-lg"
            >
              <span className="font-display text-xs text-rose-200 mr-1">Reset save?</span>
              <button
                type="button"
                onClick={() => { newGame(); setConfirmNew(false); }}
                className="flex items-center gap-1 rounded border border-crt-green/40 bg-crt-green/15 px-2 py-1 font-display text-xs text-crt-green hover:bg-crt-green/25"
              >
                <Check size={11} /> Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmNew(false)}
                className="flex items-center gap-1 rounded border border-white/20 px-2 py-1 font-display text-xs text-chrome-muted hover:text-chrome"
              >
                <X size={11} /> No
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Daily button with popover confirm */}
      <div className="relative" ref={confirmDaily ? confirmRef : undefined}>
        <button
          type="button"
          onClick={() => { setConfirmDaily((v) => !v); setConfirmNew(false); }}
          data-testid="daily-run"
          className={[
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition',
            confirmDaily
              ? 'border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200'
              : 'border-fuchsia-400/30 text-fuchsia-200 hover:bg-fuchsia-500/10',
          ].join(' ')}
        >
          <CalendarDays size={13} />
          Daily
        </button>
        <AnimatePresence>
          {confirmDaily && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full right-0 mt-2 z-30 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-fuchsia-400/40 bg-pitch-950 px-3 py-2 shadow-lg"
            >
              <span className="font-display text-xs text-fuchsia-200 mr-1">Start daily?</span>
              <button
                type="button"
                onClick={() => { newDailyRun(); setConfirmDaily(false); }}
                className="flex items-center gap-1 rounded border border-crt-green/40 bg-crt-green/15 px-2 py-1 font-display text-xs text-crt-green hover:bg-crt-green/25"
              >
                <Check size={11} /> Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDaily(false)}
                className="flex items-center gap-1 rounded border border-white/20 px-2 py-1 font-display text-xs text-chrome-muted hover:text-chrome"
              >
                <X size={11} /> No
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
