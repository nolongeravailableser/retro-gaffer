import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins, RotateCcw, AlertTriangle, Crown, CalendarDays, Check, X, Heart, Flame, Star,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { bestLabel } from '@/lib/ladder';
import { getMutator, dailyMutator } from '@/lib/mutators';
import { runConfig, getScenario } from '@/lib/scenarios';
import { dailyKey } from '@/lib/daily';
import { runScore, formatScore } from '@/lib/score';

interface HudProps {
  /** Open the New Run setup modal. */
  onNewRun?: () => void;
}

/** Top bankroll readout, run status, mode/score, run controls, and a notice toast. */
export default function Hud({ onNewRun }: HudProps) {
  const bankroll = useGameStore((s) => s.bankroll);
  const best = useGameStore((s) => s.best);
  const daily = useGameStore((s) => s.daily);
  const round = useGameStore((s) => s.round);
  const lives = useGameStore((s) => s.lives);
  const streak = useGameStore((s) => s.streak);
  const runStatus = useGameStore((s) => s.runStatus);
  const peakBankroll = useGameStore((s) => s.peakBankroll);
  const bestStreak = useGameStore((s) => s.bestStreak);
  const record = useGameStore((s) => s.record);
  const mode = useGameStore((s) => s.mode);
  const mutatorId = useGameStore((s) => s.mutator);
  const scenarioId = useGameStore((s) => s.scenario);
  const config = runConfig({ scenario: scenarioId, mode, mutator: mutatorId });
  const { maxRounds, startingLives } = config;
  const mutator = getMutator(mutatorId);
  const scenario = getScenario(scenarioId);
  const notice = useGameStore((s) => s.notice);
  const clearNotice = useGameStore((s) => s.clearNotice);
  const newDailyRun = useGameStore((s) => s.newDailyRun);
  const [confirmDaily, setConfirmDaily] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const scored = config.scored || daily !== null;
  const score = runScore({ round, runStatus, peakBankroll, bestStreak, record, maxRounds });
  const todaysRule = getMutator(dailyMutator(dailyKey()));

  // Auto-dismiss the notice after a moment.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 2200);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  // Close the daily confirm popover on outside click.
  useEffect(() => {
    if (!confirmDaily) return;
    const handler = (e: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmDaily(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirmDaily]);

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
            R{round}
            <span className="text-chrome-muted">/{Number.isFinite(maxRounds) ? maxRounds : '∞'}</span>
          </span>
          <span className="flex items-center gap-0.5" aria-label={`${lives} lives`}>
            {Array.from({ length: Math.max(startingLives, lives) }, (_, i) => (
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

      {/* Score — only for scored runs (Endless / Daily) */}
      {scored && runStatus === 'playing' && (
        <div
          className="flex items-center gap-1.5 rounded-lg border border-crt-green/30 bg-crt-green/10 px-3 py-2"
          title="Run score"
        >
          <Star size={14} className="text-crt-green" />
          <span className="font-display text-sm text-crt-green">{formatScore(score)}</span>
        </div>
      )}

      {/* Active mutator badge */}
      {mutator && (
        <div
          className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2"
          title={mutator.blurb}
        >
          <span>{mutator.emoji}</span>
          <span className="font-display text-sm text-amber-200">{mutator.name}</span>
        </div>
      )}

      {/* Active scenario badge */}
      {scenario && (
        <div
          className="flex items-center gap-1.5 rounded-lg border border-crt-green/40 bg-crt-green/10 px-3 py-2"
          title={scenario.objective}
        >
          <span>{scenario.emoji}</span>
          <span className="font-display text-sm text-crt-green">{scenario.name}</span>
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

      {/* New Game — opens the run setup modal */}
      <button
        type="button"
        onClick={() => onNewRun?.()}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-chrome-muted transition hover:text-chrome"
      >
        <RotateCcw size={13} />
        New Game
      </button>

      {/* Daily button with popover confirm + Rule of the Day */}
      <div className="relative" ref={confirmDaily ? confirmRef : undefined}>
        <button
          type="button"
          onClick={() => setConfirmDaily((v) => !v)}
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
              className="absolute top-full right-0 mt-2 z-30 flex flex-col gap-2 whitespace-nowrap rounded-lg border border-fuchsia-400/40 bg-pitch-950 px-3 py-2.5 shadow-lg"
            >
              {todaysRule && (
                <span className="flex items-center gap-1.5 text-xs text-amber-200">
                  <span>{todaysRule.emoji}</span>
                  <span className="font-display">Rule of the Day: {todaysRule.name}</span>
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="mr-1 font-display text-xs text-fuchsia-200">Start daily?</span>
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
              </div>
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
