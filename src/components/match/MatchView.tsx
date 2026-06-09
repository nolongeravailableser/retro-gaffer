import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FastForward, Trophy } from 'lucide-react';
import { simulateMatch, type MatchTeam } from '@/lib/engine';
import { generateOpponent } from '@/lib/opponent';
import { MATCH_REWARD } from '@/lib/economy';
import type { MatchResult } from '@/lib/types';

interface MatchViewProps {
  open: boolean;
  onClose: () => void;
  /** The player's starting XI as a match team, or null if none fielded. */
  playerTeam: MatchTeam | null;
  /** The opponent. When null, a PvE rival is generated from a random seed. */
  opponent?: MatchTeam | null;
  /** Deterministic match seed. When omitted, a fresh one is used per open. */
  seed?: string | null;
  /** Called exactly once at the final whistle with the result. */
  onComplete: (result: MatchResult) => void;
}

const TICK_MS = 160;

const OUTCOME_COPY = {
  win: { label: 'VICTORY', class: 'text-crt-green border-crt-green/50' },
  draw: { label: 'DRAW', class: 'text-crt-amber border-crt-amber/50' },
  loss: { label: 'DEFEAT', class: 'text-rose-300 border-rose-400/50' },
} as const;

export default function MatchView({
  open,
  onClose,
  playerTeam,
  opponent: opponentOverride = null,
  seed: seedProp = null,
  onComplete,
}: MatchViewProps) {
  const [match, setMatch] = useState<{
    result: MatchResult;
    opponent: MatchTeam;
    seed: string;
  } | null>(null);
  const [shown, setShown] = useState(0);
  const completedRef = useRef(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Build & start the match when the modal opens.
  useEffect(() => {
    if (!open || !playerTeam) return;
    const seed = seedProp ?? `M-${Date.now()}`;
    const opponent =
      opponentOverride ??
      generateOpponent(playerTeam.attack, playerTeam.defense, seed);
    const result = simulateMatch(playerTeam, opponent, seed);
    completedRef.current = false;
    setMatch({ result, opponent, seed });
    setShown(1); // reveal kickoff immediately
  }, [open, playerTeam, opponentOverride, seedProp]);

  // Drive playback, then resolve exactly once at the final whistle.
  useEffect(() => {
    if (!match) return;
    if (shown >= match.result.events.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete(match.result);
      }
      return;
    }
    const id = setTimeout(() => setShown((c) => c + 1), TICK_MS);
    return () => clearTimeout(id);
  }, [match, shown, onComplete]);

  // Auto-scroll the ticker as lines arrive.
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
  const finished = shown >= events.length;
  const outcome = OUTCOME_COPY[result.outcome];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 border-crt-dim bg-pitch-950 shadow-glow"
      >
        {/* Scoreboard */}
        <div className="relative border-b border-crt-dim bg-pitch-900/80 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close match"
            className="absolute right-3 top-3 text-chrome-muted hover:text-chrome"
          >
            <X size={18} />
          </button>
          <div className="grid grid-cols-3 items-center text-center">
            <span className="truncate font-display text-lg">{playerTeam.name}</span>
            <span className="font-ticker text-4xl text-crt-amber">
              {scoreA} <span className="text-chrome-muted">:</span> {scoreB}
            </span>
            <span className="truncate font-display text-lg">{opponent.name}</span>
          </div>
          <div className="mt-1 grid grid-cols-3 text-center text-[11px] text-chrome-muted">
            <span>xG {result.xg.a.toFixed(2)}</span>
            <span>{finished ? "FULL-TIME" : `${visible.at(-1)?.minute ?? 0}'`}</span>
            <span>xG {result.xg.b.toFixed(2)}</span>
          </div>
        </div>

        {/* Ticker */}
        <div
          ref={tickerRef}
          className="flex-1 space-y-1.5 overflow-y-auto bg-pitch-950 px-5 py-4 font-ticker text-lg leading-snug"
        >
          {visible.map((e, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className={
                e.kind === 'goal'
                  ? 'text-crt-green'
                  : e.kind === 'chance'
                    ? 'text-chrome'
                    : 'text-crt-amber'
              }
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
                className={`mt-3 flex items-center justify-between rounded-lg border px-4 py-3 ${outcome.class}`}
              >
                <span className="flex items-center gap-2 font-display text-2xl">
                  <Trophy size={20} />
                  {outcome.label}
                </span>
                <span className="font-display text-lg text-crt-amber">
                  +£{MATCH_REWARD[result.outcome]}M
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
          <span className="font-ticker text-xs text-chrome-muted">
            seed {match.seed}
          </span>
          {finished ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-crt-green/40 bg-crt-green/15 px-4 py-1.5 font-display text-sm text-crt-green hover:bg-crt-green/25"
            >
              Back to Squad
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShown(events.length)}
              className="flex items-center gap-1.5 rounded-md border border-white/15 px-4 py-1.5 font-display text-sm hover:bg-white/5"
            >
              <FastForward size={14} />
              Skip to full-time
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
