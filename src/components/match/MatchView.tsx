import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronsRight, Trophy, Ban, HeartCrack } from 'lucide-react';
import { simulateMatch, DEFAULT_TUNING, type MatchTeam, type EngineTuning } from '@/lib/engine';
import { generateOpponent } from '@/lib/opponent';
import { MATCH_REWARD } from '@/lib/economy';
import { useGameStore } from '@/store/useGameStore';
import type { MatchResult } from '@/lib/types';

interface MatchViewProps {
  open: boolean;
  onClose: () => void;
  playerTeam: MatchTeam | null;
  opponent?: MatchTeam | null;
  seed?: string | null;
  /** Match-engine tuning for the active mode (defaults to classic). */
  tuning?: EngineTuning;
  /** Ladder match → show the resolved round payout (PvP exhibitions don't). */
  ladder?: boolean;
  onComplete: (result: MatchResult) => void;
}

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

const SPEED_DELAY: Record<Speed, number> = { 1: 500, 2: 200, 4: 60 };

const OUTCOME_COPY = {
  win:  { label: 'VICTORY', cls: 'text-crt-green  border-crt-green/50'  },
  draw: { label: 'DRAW',    cls: 'text-crt-amber  border-crt-amber/50'  },
  loss: { label: 'DEFEAT',  cls: 'text-rose-300   border-rose-400/50'   },
} as const;

function eventClass(kind: string): string {
  switch (kind) {
    case 'goal':   return 'text-crt-green';
    case 'yellow': return 'text-crt-amber';
    case 'red':    return 'text-rose-300';
    case 'injury': return 'text-orange-300';
    case 'chance': return 'text-chrome';
    default:       return 'text-chrome-muted'; // flavour
  }
}

export default function MatchView({
  open,
  onClose,
  playerTeam,
  opponent: opponentOverride = null,
  seed: seedProp = null,
  tuning = DEFAULT_TUNING,
  ladder = false,
  onComplete,
}: MatchViewProps) {
  const lastIncome = useGameStore((s) => s.lastIncome);
  const bankroll = useGameStore((s) => s.bankroll);
  const [match, setMatch] = useState<{
    result: MatchResult;
    opponent: MatchTeam;
    seed: string;
  } | null>(null);
  const [shown, setShown] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const completedRef = useRef(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Latest inputs in refs so the build effect can read them WITHOUT re-running
  // when their identity changes mid-match. (A resolved round mutates roundMods,
  // which gives playerTeam a new reference; depending on it here used to restart
  // the sim and re-fire onComplete in a loop that auto-advanced the whole run.)
  const playerTeamRef = useRef(playerTeam);
  const opponentRef = useRef(opponentOverride);
  const tuningRef = useRef(tuning);
  playerTeamRef.current = playerTeam;
  opponentRef.current = opponentOverride;
  tuningRef.current = tuning;

  // Build the match once per open, or when a genuinely new match is requested
  // (new seed) — never on an incidental playerTeam re-render.
  useEffect(() => {
    if (!open) {
      setMatch(null);
      completedRef.current = false;
      return;
    }
    const pt = playerTeamRef.current;
    if (!pt) return;
    const seed = seedProp ?? `M-${Date.now()}`;
    const opponent = opponentRef.current ?? generateOpponent(pt.attack, pt.defense, seed);
    const result = simulateMatch(pt, opponent, seed, tuningRef.current);
    completedRef.current = false;
    setMatch({ result, opponent, seed });
    setShown(1);
    setSpeed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedProp]);

  // Drive playback — reruns whenever shown or speed changes.
  useEffect(() => {
    if (!match) return;
    if (shown >= match.result.events.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete(match.result);
      }
      return;
    }
    const id = setTimeout(() => setShown((c) => c + 1), SPEED_DELAY[speed]);
    return () => clearTimeout(id);
  }, [match, shown, speed, onComplete]);

  // Auto-scroll the ticker.
  useEffect(() => {
    const el = tickerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  if (!open || !playerTeam || !match) return null;

  const { result, opponent } = match;
  const events = result.events;
  const visible = events.slice(0, shown);

  const scoreA = visible.filter((e) => e.kind === 'goal' && e.side === 'A').length;
  const scoreB = visible.filter((e) => e.kind === 'goal' && e.side === 'B').length;
  const currentMinute = visible.at(-1)?.minute ?? 0;
  const progressPct = Math.min(100, Math.round((currentMinute / 90) * 100));

  const finished = shown >= events.length;
  const outcome = OUTCOME_COPY[result.outcome];
  const payoutNet = lastIncome
    ? lastIncome.reward + lastIncome.income + lastIncome.interest +
      lastIncome.streak - lastIncome.wage + lastIncome.wager
    : 0;

  const hasSuspensions = result.suspensions.length > 0;
  const hasInjuries = result.injuries.length > 0;
  const hasTeamNews = hasSuspensions || hasInjuries;

  const playerName = (id: string) =>
    playerTeam.squad.find((p) => p.id === id)?.name ?? id;

  const skipToEnd = () => setShown(events.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 border-crt-dim bg-pitch-950 shadow-glow"
      >
        {/* ── Scoreboard ── */}
        <div className="relative border-b border-crt-dim bg-pitch-900/80 px-5 pt-4 pb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close match"
            className="absolute right-3 top-3 text-chrome-muted hover:text-chrome"
          >
            <X size={18} />
          </button>

          {/* Team names + animated score */}
          <div className="grid grid-cols-3 items-center text-center">
            <span className="truncate font-display text-lg">{playerTeam.name}</span>

            <div className="flex items-center justify-center gap-2 font-ticker text-4xl">
              <motion.span
                key={scoreA}
                initial={{ scale: 1.5, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="text-crt-amber"
              >
                {scoreA}
              </motion.span>
              <span className="text-chrome-muted text-3xl">:</span>
              <motion.span
                key={scoreB + 100}
                initial={{ scale: 1.5, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="text-crt-amber"
              >
                {scoreB}
              </motion.span>
            </div>

            <span className="truncate font-display text-lg">{opponent.name}</span>
          </div>

          {/* xG row + status */}
          <div className="mt-1 grid grid-cols-3 text-center text-[11px] text-chrome-muted">
            <span>xG {result.xg.a.toFixed(2)}</span>
            <span className="flex items-center justify-center gap-1.5">
              {finished ? (
                <span className="font-display uppercase tracking-wide">Full-Time</span>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                  <span>{currentMinute}'</span>
                </>
              )}
            </span>
            <span>xG {result.xg.b.toFixed(2)}</span>
          </div>

          {/* Match progress bar */}
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-crt-green/60"
              animate={{ width: `${finished ? 100 : progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* ── Ticker ── */}
        <div
          ref={tickerRef}
          className="flex-1 space-y-1.5 overflow-y-auto bg-pitch-950 px-5 py-4 font-ticker text-base leading-snug"
        >
          {visible.map((e, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className={eventClass(e.kind)}
            >
              {e.minute > 0 && e.kind !== 'flavour' && (
                <span className="text-chrome-muted">{e.minute}' </span>
              )}
              {e.text}
            </motion.p>
          ))}

          <AnimatePresence>
            {finished && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {/* Result banner */}
                <div className={`mt-3 flex items-center justify-between rounded-lg border px-4 py-3 ${outcome.cls}`}>
                  <span className="flex items-center gap-2 font-display text-2xl">
                    <Trophy size={20} />
                    {outcome.label}
                  </span>
                  <span className="font-display text-lg text-crt-amber">
                    +£{MATCH_REWARD[result.outcome]}M
                  </span>
                </div>

                {/* Round payout — the full economic outcome, not just the reward */}
                {ladder && lastIncome && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-pitch-900/60 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm uppercase tracking-wide text-chrome-muted">
                        Round payout
                      </span>
                      <span
                        className={`font-display text-xl ${
                          payoutNet >= 0 ? 'text-crt-green' : 'text-rose-300'
                        }`}
                      >
                        {payoutNet >= 0 ? '+' : '−'}£{Math.abs(payoutNet)}M
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-chrome-muted">
                      £{lastIncome.reward} result · £{lastIncome.income} round · £
                      {lastIncome.interest} interest
                      {lastIncome.streak ? ` · £${lastIncome.streak} streak` : ''}
                      {lastIncome.wage ? ` · −£${lastIncome.wage} wages` : ''}
                      {lastIncome.wager
                        ? ` · ${lastIncome.wager > 0 ? '+' : '−'}£${Math.abs(lastIncome.wager)} bet`
                        : ''}
                    </p>
                    <p className="mt-1 text-right text-xs text-crt-amber">
                      Bankroll: £{bankroll}M
                    </p>
                  </div>
                )}

                {/* Team news */}
                {hasTeamNews && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-pitch-900/60 px-4 py-3">
                    <p className="mb-2 font-display text-sm uppercase tracking-wide text-chrome-muted">
                      Team News
                    </p>
                    <div className="space-y-1.5">
                      {result.suspensions.map((id) => (
                        <div key={id} className="flex items-center gap-2 text-sm text-rose-300">
                          <Ban size={13} className="shrink-0" />
                          <span>
                            <span className="font-display">{playerName(id)}</span>
                            {' '}— one-game suspension (red card)
                          </span>
                        </div>
                      ))}
                      {result.injuries.map((inj) => (
                        <div key={inj.playerId} className="flex items-center gap-2 text-sm text-orange-300">
                          <HeartCrack size={13} className="shrink-0" />
                          <span>
                            <span className="font-display">{playerName(inj.playerId)}</span>
                            {' '}— out for {inj.rounds === 1 ? '1 round' : `${inj.rounds} rounds`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-chrome-muted">
                      Review your squad before playing the next round.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center justify-between gap-3 border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
          <span className="font-ticker text-[11px] text-chrome-muted shrink-0">
            seed {match.seed}
          </span>

          {finished ? (
            <button
              type="button"
              onClick={onClose}
              className={[
                'ml-auto rounded-md border px-4 py-1.5 font-display text-sm transition',
                hasTeamNews
                  ? 'border-crt-amber/40 bg-crt-amber/15 text-crt-amber hover:bg-crt-amber/25'
                  : 'border-crt-green/40 bg-crt-green/15 text-crt-green hover:bg-crt-green/25',
              ].join(' ')}
            >
              {hasTeamNews ? 'Manage Squad' : 'Back to Squad'}
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              {/* Speed toggle group */}
              <div className="flex rounded-md border border-white/15 overflow-hidden">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={[
                      'px-2.5 py-1 font-display text-xs transition',
                      speed === s
                        ? 'bg-crt-green/20 text-crt-green'
                        : 'text-chrome-muted hover:text-chrome hover:bg-white/5',
                    ].join(' ')}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              {/* Instant result */}
              <button
                type="button"
                onClick={skipToEnd}
                title="Skip to full-time"
                className="flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 font-display text-xs text-chrome-muted hover:text-chrome hover:bg-white/5 transition"
              >
                <ChevronsRight size={13} />
                Instant
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
