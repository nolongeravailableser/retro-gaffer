import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Trophy, Zap, MoreHorizontal, HelpCircle, Award, CalendarDays,
  ChevronLeft, ArrowRight, Smile, ShieldHalf, Flame, Check,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { division, totalWeeks } from '@/lib/league';
import { getMode } from '@/lib/modes';
import { DIFFICULTIES, type DifficultyId } from '@/lib/difficulty';
import { getMutator, dailyMutator } from '@/lib/mutators';
import { dailyKey } from '@/lib/daily';
import { runConfig } from '@/lib/scenarios';
import CrestBadge from '@/components/ui/CrestBadge';
import RecordsPanel from '@/components/records/RecordsPanel';
import { DEFAULT_KIT } from '@/lib/kits';
import type { Tab } from '@/components/nav/MainNav';

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

  const newDailyRun = useGameStore((s) => s.newDailyRun);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);
  const [view, setView] = useState<'main' | 'difficulty' | 'records'>('main');
  const [pendingMode, setPendingMode] = useState<'career' | 'classic'>('career');
  const [picked, setPicked] = useState<DifficultyId>(difficulty);
  const [confirmDaily, setConfirmDaily] = useState(false);

  const hasRun =
    runStatus === 'playing' && (owned.length > 0 || !!career || !!league || !!cup || round > 1);

  const runSummary = () => {
    if (career) return `${division(career.tier).name} · Season ${career.season} · MW ${league?.matchweek ?? 1}`;
    if (league) return `League Season · Matchweek ${league.matchweek}`;
    if (cup) return 'Cup Run';
    return `${getMode(mode).name} · Round ${round}`;
  };

  // Season-progress for the Resume card — "where was I?" before you tap.
  const runProgress = (() => {
    if (!hasRun) return null;
    if (league) {
      const weeks = totalWeeks(league);
      return { at: Math.min(league.matchweek, weeks), of: weeks, label: `MATCHWEEK ${Math.min(league.matchweek, weeks)} OF ${weeks}` };
    }
    const max = runConfig({ scenario: null, mode, mutator: null }).maxRounds;
    if (!Number.isFinite(max)) return { at: 1, of: 1, label: `ROUND ${round} · ENDLESS` };
    return { at: round, of: max as number, label: `ROUND ${round} OF ${max}` };
  })();

  const todaysRule = getMutator(dailyMutator(dailyKey()));
  const dailyPlayed = dailyCompleted === dailyKey();

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto bg-pitch-950 p-4">
      {/* Floodlight atmosphere — pure CSS, no assets (design-mockups/08). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[55%]" style={{ background: 'radial-gradient(900px 420px at 50% -10%, rgba(57,255,20,.12), transparent 60%)' }} />
        <div className="absolute bottom-0 left-0 h-[40%] w-[50%]" style={{ background: 'radial-gradient(500px 260px at 10% 110%, rgba(255,176,0,.06), transparent 60%)' }} />
        <div className="absolute -left-16 -top-10 h-[420px] w-[280px] rotate-12" style={{ background: 'linear-gradient(195deg, rgba(255,255,255,.045), transparent 65%)' }} />
        <div className="absolute -right-16 -top-10 h-[420px] w-[280px] -rotate-12" style={{ background: 'linear-gradient(165deg, rgba(255,255,255,.045), transparent 65%)' }} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className={`relative w-full ${view === 'records' ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        {/* Wordmark — match night, not a settings dialog */}
        <div className="mb-5 text-center">
          <p className="font-display text-3xl tracking-[0.12em] text-crt-green" style={{ textShadow: '0 0 28px rgba(57,255,20,.35)' }}>
            ⚽ RETRO GAFFER
          </p>
          <p className="mt-0.5 font-data text-[10px] uppercase tracking-[0.3em] text-chrome-muted/70">
            Thirty years of football · one dugout
          </p>
        </div>
        <div className="mb-4 flex items-center justify-center gap-2.5">
          <CrestBadge name={clubName ?? 'Your club'} kit={kit ?? DEFAULT_KIT} size={26} />
          <p className="font-display text-sm text-chrome">{clubName ?? 'Your club'}</p>
          {managerName && <p className="text-xs text-chrome-muted">· {managerName}</p>}
        </div>

        {view === 'main' ? (
          <div className="space-y-3">
            {hasRun && (
              <button
                type="button"
                onClick={() => onEnter()}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-crt-green bg-pitch-900/70 px-5 py-4 text-left shadow-glow transition hover:bg-pitch-900"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-crt-green text-pitch-950">
                  <Play size={20} className="ml-0.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-crt-green">Resume {career ? 'career' : 'run'}</p>
                  <p className="truncate text-xs text-chrome-muted">
                    {runSummary()} · <span className="font-data text-crt-amber">£{bankroll}M</span>
                  </p>
                  {/* Trajectory — where the season stands, before you tap */}
                  {runProgress && (
                    <div className="mt-1.5">
                      <div className="h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-crt-green/80"
                          style={{ width: `${Math.round((runProgress.at / Math.max(runProgress.of, 1)) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 font-data text-[9px] tracking-wider text-chrome-muted/70">
                        {runProgress.label}
                      </p>
                    </div>
                  )}
                </div>
                <ArrowRight className="shrink-0 text-crt-green" size={18} />
              </button>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                data-testid="menu-new-career"
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

            {/* Daily Gauntlet — the retention hook, on the front door with its live rule */}
            <div className="flex justify-center">
              {!confirmDaily ? (
                <button
                  type="button"
                  onClick={() => setConfirmDaily(true)}
                  data-testid="menu-daily"
                  className="flex items-center gap-2 rounded-full border border-crt-amber/40 bg-crt-amber/5 px-4 py-1.5 text-xs text-crt-amber transition hover:bg-crt-amber/15"
                >
                  <CalendarDays size={13} />
                  Daily Gauntlet{todaysRule ? ` · today's rule: ${todaysRule.emoji} ${todaysRule.name}` : ''}
                  {dailyPlayed && <span className="text-crt-amber/60">· played ✓</span>}
                </button>
              ) : (
                <span className="flex items-center gap-2 rounded-full border border-crt-amber/60 bg-crt-amber/10 px-4 py-1.5 text-xs text-crt-amber">
                  {dailyPlayed ? 'Replay for practice?' : 'Start today’s Daily?'}
                  <button
                    type="button"
                    onClick={() => { newDailyRun(); setConfirmDaily(false); onEnter('home'); }}
                    className="rounded-full border border-crt-green/50 bg-crt-green/15 px-2.5 py-0.5 font-display text-crt-green hover:bg-crt-green/25"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDaily(false)}
                    className="rounded-full border border-white/20 px-2.5 py-0.5 font-display text-chrome-muted hover:text-chrome"
                  >
                    No
                  </button>
                </span>
              )}
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
              data-testid="start-pending-mode"
              onClick={() => {
                if (pendingMode === 'classic') { startClassicDraft(picked); onEnter('squad'); }
                else { startCareer(picked); onEnter('squad'); }
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
