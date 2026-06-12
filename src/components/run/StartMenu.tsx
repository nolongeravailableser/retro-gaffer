import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Trophy, Zap, MoreHorizontal, HelpCircle, Award,
  ChevronLeft, ArrowRight, Smile, ShieldHalf, Flame, Check,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { division } from '@/lib/league';
import { getMode } from '@/lib/modes';
import { DIFFICULTIES, type DifficultyId } from '@/lib/difficulty';
import CrestBadge from '@/components/ui/CrestBadge';
import RecordsPanel from '@/components/records/RecordsPanel';
import { DEFAULT_KIT } from '@/lib/kits';
import type { Tab } from '@/components/nav/TabNav';

interface StartMenuProps {
  /** Dismiss the menu and enter the game, optionally routing to a tab. */
  onEnter: (tab?: Tab) => void;
  /** Open the full mode picker (the demoted modes live here). */
  onMoreModes: () => void;
  /** Open the how-to-play tutorial. */
  onTutorial: () => void;
}

const DIFF_ICON: Record<DifficultyId, typeof Smile> = {
  easy: Smile,
  standard: ShieldHalf,
  hardcore: Flame,
};
const DIFF_ACCENT: Record<DifficultyId, string> = {
  easy: 'text-emerald-400',
  standard: 'text-crt-amber',
  hardcore: 'text-rose-400',
};

/**
 * The front door (Pillar 2). On load the manager lands here: Resume is one click,
 * a new career picks a difficulty, Quick Classic is the fast loop, and the other
 * modes are demoted behind "More ways to play". First-time visitors are handled
 * by the onboarding modal (shown above this) before they ever reach a run.
 */
export default function StartMenu({ onEnter, onMoreModes, onTutorial }: StartMenuProps) {
  const clubName = useGameStore((s) => s.clubName);
  const managerName = useGameStore((s) => s.managerName);
  const kit = useGameStore((s) => s.kit);
  const runStatus = useGameStore((s) => s.runStatus);
  const mode = useGameStore((s) => s.mode);
  const round = useGameStore((s) => s.round);
  const bankroll = useGameStore((s) => s.bankroll);
  const owned = useGameStore((s) => s.owned);
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const cup = useGameStore((s) => s.cup);
  const difficulty = useGameStore((s) => s.difficulty);
  const startCareer = useGameStore((s) => s.startCareer);
  const startClassicDraft = useGameStore((s) => s.startClassicDraft);

  const [view, setView] = useState<'main' | 'difficulty' | 'records'>('main');
  const [pendingMode, setPendingMode] = useState<'career' | 'classic'>('career');
  const [picked, setPicked] = useState<DifficultyId>(difficulty);

  const hasRun =
    runStatus === 'playing' && (owned.length > 0 || !!career || !!league || !!cup || round > 1);

  const runSummary = () => {
    if (career) return `${division(career.tier).name} · Season ${career.season} · MW ${league?.matchweek ?? 1}`;
    if (league) return `League Season · Matchweek ${league.matchweek}`;
    if (cup) return 'Cup Run';
    return `${getMode(mode).name} · Round ${round}`;
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto bg-pitch-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className={`w-full ${view === 'records' ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CrestBadge name={clubName ?? 'Your club'} kit={kit ?? DEFAULT_KIT} size={34} />
            <div>
              <p className="font-display text-base text-crt-green">{clubName ?? 'Your club'}</p>
              {managerName && <p className="text-xs text-chrome-muted">Manager: {managerName}</p>}
            </div>
          </div>
          <p className="font-display text-sm tracking-wide text-crt-amber">RETRO GAFFER</p>
        </div>

        {view === 'main' ? (
          <div className="space-y-3">
            {hasRun && (
              <button
                type="button"
                onClick={() => onEnter()}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-crt-green bg-pitch-900/70 px-5 py-4 text-left shadow-glow transition hover:bg-pitch-900"
              >
                <Play className="shrink-0 text-crt-green" size={30} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-crt-green">Resume {career ? 'career' : 'run'}</p>
                  <p className="truncate text-xs text-chrome-muted">
                    {runSummary()} · £{bankroll}M
                  </p>
                </div>
                <ArrowRight className="shrink-0 text-crt-green" size={18} />
              </button>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { setPendingMode('career'); setPicked(difficulty); setView('difficulty'); }}
                className="flex items-center gap-3 rounded-xl border border-crt-dim bg-pitch-900/50 px-4 py-3 text-left transition hover:border-crt-green/60"
              >
                <Trophy className="shrink-0 text-chrome" size={22} />
                <div>
                  <p className="font-display text-sm text-chrome">New career</p>
                  <p className="text-[11px] text-chrome-muted">Climb the pyramid</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setPendingMode('classic'); setPicked(difficulty); setView('difficulty'); }}
                className="flex items-center gap-3 rounded-xl border border-crt-dim bg-pitch-900/50 px-4 py-3 text-left transition hover:border-crt-green/60"
              >
                <Zap className="shrink-0 text-chrome" size={22} />
                <div>
                  <p className="font-display text-sm text-chrome">Quick classic</p>
                  <p className="text-[11px] text-chrome-muted">Draft a squad, win the league</p>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pt-1 text-sm text-chrome-muted">
              <button type="button" onClick={onMoreModes} className="flex items-center gap-1.5 transition hover:text-crt-green">
                <MoreHorizontal size={15} /> More ways to play
              </button>
              <button type="button" onClick={onTutorial} className="flex items-center gap-1.5 transition hover:text-crt-green">
                <HelpCircle size={15} /> How to play
              </button>
              <button type="button" onClick={() => setView('records')} className="flex items-center gap-1.5 transition hover:text-crt-green">
                <Award size={15} /> Records
              </button>
            </div>
            <p className="px-1 text-[11px] text-chrome-muted/70">
              More ways to play → Endless · Cup · Scenarios · Daily Gauntlet
            </p>
          </div>
        ) : view === 'records' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setView('main')} aria-label="Back" className="text-chrome-muted hover:text-chrome">
                <ChevronLeft size={20} />
              </button>
              <p className="font-display text-sm text-chrome">Records</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-crt-dim bg-pitch-900/50 p-3">
              <RecordsPanel />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setView('main')} aria-label="Back" className="text-chrome-muted hover:text-chrome">
                <ChevronLeft size={20} />
              </button>
              <p className="font-display text-sm text-chrome">
                {pendingMode === 'classic' ? 'Quick classic' : 'New career'} — choose difficulty
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.values(DIFFICULTIES)).map((d) => {
                const Icon = DIFF_ICON[d.id];
                const active = picked === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPicked(d.id)}
                    className={`rounded-xl border bg-pitch-900/50 px-3 py-3 text-left transition ${
                      active ? 'border-2 border-crt-green' : 'border-crt-dim hover:border-crt-green/50'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Icon size={18} className={DIFF_ACCENT[d.id]} />
                        <span className="font-display text-sm text-chrome">{d.name}</span>
                      </span>
                      {active && <Check size={15} className="text-crt-green" />}
                      {d.id === 'standard' && !active && (
                        <span className="rounded bg-crt-amber/15 px-1.5 py-0.5 text-[9px] uppercase text-crt-amber">Rec</span>
                      )}
                    </div>
                    <ul className="space-y-1 text-[11px] leading-snug text-chrome-muted">
                      {d.effects.map((e, i) => (
                        <li key={i} className="flex gap-1"><span className="text-chrome-muted/60">·</span>{e}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                if (pendingMode === 'classic') { startClassicDraft(picked); onEnter('formation'); }
                else { startCareer(picked); onEnter('formation'); }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-crt-green bg-pitch-900/70 py-3 font-display text-crt-green shadow-glow transition hover:bg-pitch-900"
            >
              {pendingMode === 'classic' ? 'Start draft' : 'Start career'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
