import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Crown, RotateCcw, Share2, Check, X, Play, Briefcase,
} from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { ladderTier, bestLabel } from '@/lib/ladder';
import { table as leagueTable, position as leaguePosition, YOU } from '@/lib/league';
import { getMutator } from '@/lib/mutators';
import { runConfig, getScenario } from '@/lib/scenarios';
import { boardWantsTitle } from '@/lib/career';
import { runScore, formatScore } from '@/lib/score';
import { formatRunResult } from '@/lib/daily';
import { submitDailyScore } from '@/lib/leaderboard';
import DailyLeaderboard from '@/components/records/DailyLeaderboard';
import Stars from '@/components/ui/Stars';

interface RunOverModalProps {
  /** Open the New Run setup modal (full mode/mutator picker). */
  onNewRun?: () => void;
}

/**
 * The end-of-run moment. A celebratory (or commiserating) overlay shown over
 * whatever tab the player is on when a run terminates — so the climax is never
 * a silent inline swap, and is never hidden behind the squad screen.
 */
export default function RunOverModal({ onNewRun }: RunOverModalProps) {
  const runStatus = useGameStore((s) => s.runStatus);
  const round = useGameStore((s) => s.round);
  const record = useGameStore((s) => s.record);
  const bestStreak = useGameStore((s) => s.bestStreak);
  const peakBankroll = useGameStore((s) => s.peakBankroll);
  const best = useGameStore((s) => s.best);
  const owned = useGameStore((s) => s.owned);
  const daily = useGameStore((s) => s.daily);
  const mode = useGameStore((s) => s.mode);
  const mutatorId = useGameStore((s) => s.mutator);
  const scenarioId = useGameStore((s) => s.scenario);
  const scenarioStars = useGameStore((s) => s.scenarioStars);
  const career = useGameStore((s) => s.career);
  const careerBest = useGameStore((s) => s.careerBest);
  const clubName = useGameStore((s) => s.clubName);
  const league = useGameStore((s) => s.league);

  const startRun = useGameStore((s) => s.startRun);
  const startLeague = useGameStore((s) => s.startLeague);
  const startScenario = useGameStore((s) => s.startScenario);
  const startCareer = useGameStore((s) => s.startCareer);
  const newDailyRun = useGameStore((s) => s.newDailyRun);

  const [shared, setShared] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Reset the dismissed flag whenever a fresh run begins.
  useEffect(() => {
    if (runStatus === 'playing') setDismissed(false);
  }, [runStatus]);

  // A finished Daily posts its score to the world board (deduped per day,
  // fire-and-forget, silently skipped when the backend is unavailable).
  useEffect(() => {
    if (runStatus === 'playing' || !daily) return;
    const cfg = runConfig({ scenario: scenarioId, mode, mutator: mutatorId });
    const sc = runScore({
      round, runStatus, peakBankroll, bestStreak, record, maxRounds: cfg.maxRounds,
    });
    void submitDailyScore({ day: daily, score: sc, club: clubName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus, daily]);

  if (runStatus === 'playing' || dismissed) return null;

  const won = runStatus === 'won';
  // League finishing position + table record (when this was a League Season).
  const leaguePos = league ? leaguePosition(league, YOU) : 0;
  const leagueRow = league ? leagueTable(league).find((r) => r.teamId === YOU) ?? null : null;
  const ord = (n: number) => {
    const v = n % 100;
    return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th');
  };
  const config = runConfig({ scenario: scenarioId, mode, mutator: mutatorId });
  const { maxRounds } = config;
  const scenario = getScenario(scenarioId);
  const mutator = getMutator(mutatorId);
  const scored = config.scored || daily !== null;
  const reached = won ? maxRounds : round;
  const isNewBest = reached >= best.round && best.round > 0;
  const squadValue = owned.reduce((sum, id) => sum + (getPlayer(id)?.cost ?? 0), 0);
  const score = runScore({ round, runStatus, peakBankroll, bestStreak, record, maxRounds });

  const stats: [string, string][] = [
    ...(scored ? ([['Score', formatScore(score)]] as [string, string][]) : []),
    ...(career
      ? ([['Seasons survived', `${Math.max(careerBest, career.season - 1)}`]] as [string, string][])
      : []),
    league
      ? ['Finished', won ? 'Champions 🏆' : `${ord(leaguePos)} of ${league.clubs.length}`]
      : ['Reached', won ? 'Champions League winner' : `Round ${round} · ${ladderTier(round)}`],
    [
      'Record',
      leagueRow
        ? `${leagueRow.won}W · ${leagueRow.drawn}D · ${leagueRow.lost}L`
        : `${record.w}W · ${record.d}D · ${record.l}L`,
    ],
    ['Best streak', `${bestStreak} wins`],
    ['Peak bankroll', `£${peakBankroll}M`],
    ...(mutator
      ? ([['Modifier', `${mutator.emoji} ${mutator.name}`]] as [string, string][])
      : [['Squad value', `£${squadValue}M`] as [string, string]]),
    ['Career best', bestLabel(best.round)],
  ];

  const frame = won
    ? 'border-crt-green/50'
    : config.scored
      ? 'border-crt-amber/50'
      : 'border-rose-400/50';
  const accent = won ? 'text-crt-green' : config.scored ? 'text-crt-amber' : 'text-rose-300';
  const heading = career
    ? 'SACKED — CAREER OVER'
    : league
      ? won ? 'LEAGUE CHAMPIONS!' : 'SEASON OVER'
      : scenario
        ? won ? 'CHALLENGE COMPLETE' : 'CHALLENGE FAILED'
        : won
          ? 'CHAMPIONS OF EUROPE!'
          : config.scored
            ? 'RUN OVER'
            : 'SACKED BY THE BOARD';

  // Mode-aware replay: "run it back" should restart the SAME thing you played.
  const replay = () => {
    if (scenarioId) startScenario(scenarioId);
    else if (career) startCareer();
    else if (league) startLeague();
    else if (daily) newDailyRun();
    else startRun(mode, mutatorId);
  };
  const replayLabel = scenarioId
    ? 'Retry Challenge'
    : career
      ? 'New Career'
      : league
        ? 'New League Season'
        : daily
          ? "Replay Daily"
          : mode === 'endless'
            ? 'New Endless Run'
            : 'New Run';

  const share = async () => {
    const text = formatRunResult({
      daily, status: runStatus, round, record, peakBankroll, bestStreak, clubName,
    });
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className={`flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 bg-pitch-950 shadow-glow ${frame}`}
        >
          {/* Header — the moment */}
          <div className="relative border-b border-crt-dim bg-pitch-900/80 px-5 py-5 text-center">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="absolute right-3 top-3 text-chrome-muted hover:text-chrome"
            >
              <X size={18} />
            </button>
            <motion.div
              initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 16 }}
              className={`mx-auto mb-2 w-fit ${accent}`}
            >
              <Trophy size={40} className={won ? 'animate-flicker' : ''} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className={`font-display text-2xl ${accent}`}
            >
              {heading}
            </motion.h2>

            {scenario && (
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className="font-display text-sm text-chrome">
                  {scenario.emoji} {scenario.name}
                </span>
                {won ? (
                  <Stars earned={scenarioStars[scenario.id] ?? 0} size={20} />
                ) : (
                  <span className="text-xs text-chrome-muted">{scenario.objective}</span>
                )}
              </div>
            )}

            {/* Career: WHY you were sacked — the demand vs. what you reached. */}
            {career && (
              <p className="mx-auto mt-2 flex max-w-sm items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
                <Briefcase size={13} className="shrink-0" />
                <span>
                  Season {career.season}: the board wanted{' '}
                  <span className="font-display">
                    {boardWantsTitle(career.season)
                      ? 'the title'
                      : `${ladderTier(career.targetRound)} (round ${career.targetRound})`}
                  </span>{' '}
                  — you reached <span className="font-display">{ladderTier(round)}</span>.
                </span>
              </p>
            )}

            {!scenario && !career && isNewBest && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-crt-amber/50 bg-crt-amber/15 px-2 py-0.5 text-xs font-display text-crt-amber"
              >
                <Crown size={12} /> NEW CAREER BEST
              </motion.span>
            )}
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex flex-col gap-3 overflow-y-auto px-5 py-4"
          >
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {stats.map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 bg-pitch-900/50 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-chrome-muted">{k}</dt>
                  <dd className="font-display text-chrome">{v}</dd>
                </div>
              ))}
            </dl>
            {/* World standings for a finished Daily (hidden when offline). */}
            {daily && <DailyLeaderboard day={daily} compact />}
          </motion.div>

          {/* Actions */}
          <div className="flex flex-col gap-2 border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={share}
                data-testid="share-result"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-2 font-display text-sm text-fuchsia-200 hover:bg-fuchsia-500/20"
              >
                {shared ? <Check size={14} className="text-crt-green" /> : <Share2 size={14} />}
                {shared ? 'Copied!' : 'Share'}
              </button>
              <button
                type="button"
                onClick={replay}
                data-testid="run-over-replay"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
              >
                <Play size={14} /> {replayLabel}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setDismissed(true); onNewRun?.(); }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 font-display text-sm text-chrome-muted hover:bg-white/5 hover:text-chrome"
            >
              <RotateCcw size={14} /> Change mode…
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
