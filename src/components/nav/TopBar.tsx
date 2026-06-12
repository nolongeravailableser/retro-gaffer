import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins, Menu, RotateCcw, CalendarDays, HelpCircle, Home, Heart, Flame, Star,
  AlertTriangle, CheckCircle2, Info, Check, X,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { getMutator, dailyMutator } from '@/lib/mutators';
import { runConfig, getScenario } from '@/lib/scenarios';
import { division, totalWeeks } from '@/lib/league';
import { dailyKey } from '@/lib/daily';
import { runScore, formatScore } from '@/lib/score';
import { DEFAULT_KIT } from '@/lib/kits';
import CrestBadge from '@/components/ui/CrestBadge';

interface TopBarProps {
  /** Open the New Run setup modal. */
  onNewRun: () => void;
  /** Replay the tutorial. */
  onTutorial: () => void;
  /** Return to the Start Menu (the front door). */
  onMainMenu: () => void;
}

/**
 * The one-row chrome: club identity (tap → Start Menu), bank + run-status pills,
 * and a ☰ menu hosting the occasional actions (New Game, Daily, tutorial) that
 * used to be first-class header buttons. Replaces the old 4-row header + Hud.
 */
export default function TopBar({ onNewRun, onTutorial, onMainMenu }: TopBarProps) {
  const bankroll = useGameStore((s) => s.bankroll);
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
  const daily = useGameStore((s) => s.daily);
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const clubName = useGameStore((s) => s.clubName);
  const managerName = useGameStore((s) => s.managerName);
  const kit = useGameStore((s) => s.kit);
  const notice = useGameStore((s) => s.notice);
  const noticeKind = useGameStore((s) => s.noticeKind);
  const clearNotice = useGameStore((s) => s.clearNotice);
  const newDailyRun = useGameStore((s) => s.newDailyRun);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDaily, setConfirmDaily] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const config = runConfig({ scenario: scenarioId, mode, mutator: mutatorId });
  const mutator = getMutator(mutatorId);
  const scenario = getScenario(scenarioId);
  const scored = config.scored || daily !== null;
  const score = runScore({ round, runStatus, peakBankroll, bestStreak, record, maxRounds: config.maxRounds });
  const todayKey = dailyKey();
  const todaysRule = getMutator(dailyMutator(todayKey));
  const dailyAlreadyPlayed = dailyCompleted === todayKey;

  const draftTournament = mode === 'classic' && !career && !!league;
  const playing = runStatus === 'playing';

  // Context line under the club name: where this run is in the world.
  const contextLine = career
    ? `${division(career.tier).name} · Season ${career.season}`
    : league
      ? mode === 'classic' ? 'Draft League' : 'League Season'
      : scenario
        ? `${scenario.emoji} ${scenario.name}`
        : daily
          ? `Daily ${daily}`
          : managerName ?? null;

  // Auto-dismiss the notice — errors linger so they can be read; success is brief.
  useEffect(() => {
    if (!notice) return;
    const ms = noticeKind === 'error' ? 4500 : noticeKind === 'success' ? 1800 : 2600;
    const t = setTimeout(clearNotice, ms);
    return () => clearTimeout(t);
  }, [notice, noticeKind, clearNotice]);

  const TOAST = {
    error: { cls: 'border-rose-400/40 bg-rose-500/15 text-rose-200', Icon: AlertTriangle },
    success: { cls: 'border-crt-green/40 bg-crt-green/15 text-crt-green', Icon: CheckCircle2 },
    info: { cls: 'border-sky-400/40 bg-sky-500/15 text-sky-200', Icon: Info },
  }[noticeKind];

  // Close the menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDaily(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className="relative flex items-center gap-2.5 py-2.5">
      {/* Club identity — tapping it returns to the Start Menu */}
      <button
        type="button"
        onClick={onMainMenu}
        aria-label="Main menu"
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition hover:opacity-80"
      >
        <CrestBadge name={clubName ?? 'Your XI'} kit={kit ?? DEFAULT_KIT} size={30} />
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-display text-[15px] text-chrome">
            {(clubName ?? 'YOUR XI').toUpperCase()}
          </span>
          {contextLine && (
            <span className="block truncate text-[11px] text-chrome-muted">{contextLine}</span>
          )}
        </span>
      </button>

      {/* Bank — hidden in the Draft tournament (bank locked at £0) */}
      {!draftTournament && (
        <motion.span
          key={bankroll}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-surface-1 px-2.5 py-1.5 sm:px-3"
        >
          <Coins size={13} className="hidden text-crt-amber sm:block" />
          <span className="font-data text-[13px] text-crt-amber">£{bankroll}M</span>
        </motion.span>
      )}

      {/* Run status — MW/R + lives + streak in one pill */}
      {playing && (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-surface-1 px-2.5 py-1.5 sm:gap-2 sm:px-3">
          <span className="font-data text-[13px] text-chrome">
            {league ? `MW ${round}` : `R${round}`}
            <span className="text-chrome-muted">
              /{league ? totalWeeks(league) : Number.isFinite(config.maxRounds) ? config.maxRounds : '∞'}
            </span>
          </span>
          {!league && (
            <span className="flex items-center gap-0.5" aria-label={`${lives} lives`}>
              {Array.from({ length: Math.max(config.startingLives, lives) }, (_, i) => (
                <Heart key={i} size={10} className={i < lives ? 'fill-rose-400 text-rose-400' : 'text-white/15'} />
              ))}
            </span>
          )}
          {streak > 0 && (
            <span className="hidden items-center gap-0.5 font-data text-[12px] text-crt-amber sm:flex">
              <Flame size={11} />{streak}
            </span>
          )}
        </span>
      )}

      {/* Score (Endless/Daily) — compact, hidden on the narrowest screens */}
      {scored && playing && (
        <span
          className="hidden sm:flex shrink-0 items-center gap-1 rounded-full border border-crt-green/30 bg-crt-green/10 px-2.5 py-1.5"
          title={mutator ? `Run score · Rule: ${mutator.name}` : 'Run score'}
        >
          <Star size={11} className="text-crt-green" />
          <span className="font-data text-[12px] text-crt-green">{formatScore(score)}</span>
        </span>
      )}

      {/* ☰ — New Game / Daily / tutorial / Start Menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => { setMenuOpen((v) => !v); setConfirmDaily(false); }}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className={[
            'flex h-9 w-9 items-center justify-center rounded-xl border transition',
            menuOpen ? 'border-crt-green/50 bg-crt-green/10 text-crt-green' : 'border-white/10 bg-surface-1 text-chrome-muted hover:text-chrome',
          ].join(' ')}
        >
          <Menu size={16} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-white/15 bg-pitch-950 shadow-card"
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onMainMenu(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-chrome hover:bg-surface-2"
              >
                <Home size={14} className="text-chrome-muted" /> Main menu
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onNewRun(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-chrome hover:bg-surface-2"
              >
                <RotateCcw size={14} className="text-chrome-muted" /> New game…
              </button>
              <button
                type="button"
                data-testid="daily-run"
                onClick={() => setConfirmDaily((v) => !v)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-fuchsia-200 hover:bg-surface-2"
              >
                <CalendarDays size={14} /> Daily Gauntlet
                {todaysRule && <span className="ml-auto text-xs opacity-80">{todaysRule.emoji}</span>}
              </button>
              {confirmDaily && (
                <div className="border-t border-white/10 bg-surface-1 px-4 py-2.5">
                  {todaysRule && (
                    <p className="mb-1 text-xs text-amber-200">
                      {todaysRule.emoji} Rule of the Day: <span className="font-display">{todaysRule.name}</span>
                    </p>
                  )}
                  {dailyAlreadyPlayed && (
                    <p className="mb-1.5 text-[11px] text-chrome-muted">
                      Already played today — your score is locked. Replaying is practice.
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="mr-1 font-display text-xs text-fuchsia-200">
                      {dailyAlreadyPlayed ? 'Replay anyway?' : 'Start daily?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { newDailyRun(); setMenuOpen(false); setConfirmDaily(false); }}
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
                </div>
              )}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onTutorial(); }}
                className="flex w-full items-center gap-2.5 border-t border-white/10 px-4 py-2.5 text-left text-sm text-chrome hover:bg-surface-2"
              >
                <HelpCircle size={14} className="text-chrome-muted" /> How to play
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast — tone-styled, tap to dismiss */}
      <AnimatePresence>
        {notice && (
          <motion.button
            type="button"
            onClick={clearNotice}
            initial={{ opacity: 0, y: -8, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -8, x: '-50%' }}
            role="status"
            title="Dismiss"
            className={`absolute left-1/2 top-full z-40 flex max-w-[90vw] cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${TOAST.cls}`}
          >
            <TOAST.Icon size={14} className="shrink-0" />
            <span className="truncate">{notice}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
