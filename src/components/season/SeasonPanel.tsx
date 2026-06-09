import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Flame, Trophy, Play, RotateCcw, Swords, TrendingUp, Crown, Share2, Check, Dice5,
  ShieldCheck, HeartPulse,
} from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import {
  MAX_ROUNDS,
  STARTING_LIVES,
  ladderTier,
  bestLabel,
  interest,
  streakBonus,
  wageBill,
  maxWager,
  lifeBuybackCost,
  ROUND_INCOME,
} from '@/lib/ladder';
import { formatRunResult } from '@/lib/daily';
import { getBoss } from '@/lib/bosses';
import type { MatchTeam } from '@/lib/engine';

interface SeasonPanelProps {
  /** This round's opponent (for the preview), or null if no XI fielded. */
  roundOpponent: MatchTeam | null;
  canPlay: boolean;
  onPlay: () => void;
}

export default function SeasonPanel({ roundOpponent, canPlay, onPlay }: SeasonPanelProps) {
  const round = useGameStore((s) => s.round);
  const lives = useGameStore((s) => s.lives);
  const streak = useGameStore((s) => s.streak);
  const runStatus = useGameStore((s) => s.runStatus);
  const record = useGameStore((s) => s.record);
  const bankroll = useGameStore((s) => s.bankroll);
  const lastIncome = useGameStore((s) => s.lastIncome);
  const bestStreak = useGameStore((s) => s.bestStreak);
  const peakBankroll = useGameStore((s) => s.peakBankroll);
  const best = useGameStore((s) => s.best);
  const owned = useGameStore((s) => s.owned);
  const daily = useGameStore((s) => s.daily);
  const wager = useGameStore((s) => s.wager);
  const setWager = useGameStore((s) => s.setWager);
  const shield = useGameStore((s) => s.shield);
  const lifeBuybacks = useGameStore((s) => s.lifeBuybacks);
  const buyLife = useGameStore((s) => s.buyLife);
  const newGame = useGameStore((s) => s.newGame);
  const [shared, setShared] = useState(false);

  if (runStatus !== 'playing') {
    const won = runStatus === 'won';
    const reached = won ? MAX_ROUNDS : round;
    const isNewBest = reached >= best.round;
    const squadValue = owned.reduce((sum, id) => sum + (getPlayer(id)?.cost ?? 0), 0);
    const stats: [string, string][] = [
      ['Reached', won ? 'Champions League winner' : `Round ${round} · ${ladderTier(round)}`],
      ['Record', `${record.w}W · ${record.d}D · ${record.l}L`],
      ['Best streak', `${bestStreak} wins`],
      ['Peak bankroll', `£${peakBankroll}M`],
      ['Squad value', `£${squadValue}M`],
      ['Career best', bestLabel(best.round)],
    ];
    return (
      <div
        className={`rounded-xl border p-5 ${
          won ? 'border-crt-green/50 bg-crt-green/10' : 'border-rose-400/50 bg-rose-500/10'
        }`}
      >
        <div className="text-center">
          <Trophy
            size={32}
            className={`mx-auto mb-2 ${won ? 'text-crt-green' : 'text-rose-300'}`}
          />
          <h2 className="font-display text-2xl">
            {won ? 'CHAMPIONS OF EUROPE!' : 'SACKED BY THE BOARD'}
          </h2>
          {isNewBest && best.round > 0 && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-crt-amber/50 bg-crt-amber/15 px-2 py-0.5 text-xs font-display text-crt-amber">
              <Crown size={12} /> NEW CAREER BEST
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/10 bg-pitch-900/50 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-chrome-muted">{k}</dt>
              <dd className="font-display text-chrome">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const text = formatRunResult({
                daily,
                status: runStatus,
                round,
                record,
                peakBankroll,
                bestStreak,
              });
              try {
                await navigator.clipboard.writeText(text);
                setShared(true);
                setTimeout(() => setShared(false), 1600);
              } catch {
                /* clipboard blocked — no-op */
              }
            }}
            data-testid="share-result"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-2 font-display text-sm text-fuchsia-200 hover:bg-fuchsia-500/20"
          >
            {shared ? <Check size={14} className="text-crt-green" /> : <Share2 size={14} />}
            {shared ? 'Copied!' : 'Share result'}
          </button>
          <button
            type="button"
            onClick={() => confirm('Start a new season? Squad & bankroll reset.') && newGame()}
            data-testid="new-season"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 font-display text-sm hover:bg-white/5"
          >
            <RotateCcw size={14} /> New Season
          </button>
        </div>
      </div>
    );
  }

  const projectedInterest = interest(bankroll);
  const wage = wageBill(owned.length);
  const netLast = lastIncome
    ? lastIncome.reward +
      lastIncome.income +
      lastIncome.interest +
      lastIncome.streak -
      lastIncome.wage +
      lastIncome.wager
    : 0;
  const boss = getBoss(round);

  return (
    <div
      className={`rounded-xl border p-4 ${
        boss ? 'border-fuchsia-400/50 bg-fuchsia-500/5' : 'border-white/10 bg-pitch-900/70'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-chrome-muted">
            Round {round}/{MAX_ROUNDS}
            {boss && <span className="ml-1.5 text-fuchsia-300">· BOSS</span>}
          </p>
          <h2 className="font-display text-xl">{ladderTier(round)}</h2>
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span className="flex items-center gap-1 font-display text-crt-amber">
              <Flame size={16} />
              {streak}
            </span>
          )}
          <span className="flex items-center gap-0.5" aria-label={`${lives} lives`}>
            {Array.from({ length: Math.max(STARTING_LIVES, lives) }, (_, i) => (
              <Heart
                key={i}
                size={16}
                className={i < lives ? 'fill-rose-400 text-rose-400' : 'text-white/15'}
              />
            ))}
          </span>
          {shield && (
            <span title="Clean-sheet shield — absorbs your next defeat" aria-label="shield active">
              <ShieldCheck size={16} className="text-crt-green" />
            </span>
          )}
        </div>
      </div>

      {/* Boss flavour + stakes */}
      {boss && (
        <div className="mb-2 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2">
          <p className="text-sm text-fuchsia-100">{boss.ruleText}</p>
          <div className="mt-1 flex gap-1.5 text-[10px] font-display uppercase tracking-wide">
            {boss.lifeCost > 1 && (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">
                −{boss.lifeCost} lives on loss
              </span>
            )}
            {boss.suddenDeath && (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">
                Sudden death · draw = loss
              </span>
            )}
          </div>
        </div>
      )}

      {/* Next opponent */}
      <div
        className={`mb-3 flex items-center justify-between rounded-lg border px-3 py-2 ${
          boss ? 'border-fuchsia-400/40 bg-fuchsia-500/10' : 'border-white/10 bg-pitch-800/60'
        }`}
      >
        <span className="flex items-center gap-2 text-sm">
          <Swords size={15} className={boss ? 'text-fuchsia-300' : 'text-chrome-muted'} />
          <span className="font-display">{roundOpponent?.name ?? 'Awaiting draw…'}</span>
        </span>
        {roundOpponent && (
          <span className="text-xs text-chrome-muted">
            ATK {roundOpponent.attack} · DEF {roundOpponent.defense}
          </span>
        )}
      </div>

      {/* Buy back a lost life */}
      {lives < STARTING_LIVES && (
        <button
          type="button"
          onClick={buyLife}
          disabled={bankroll < lifeBuybackCost(lifeBuybacks)}
          data-testid="buy-life"
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 py-1.5 text-xs font-display text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HeartPulse size={14} /> Buy a life · £{lifeBuybackCost(lifeBuybacks)}M
        </button>
      )}

      {/* Economy preview / last payout */}
      <div className="mb-2 flex items-center justify-between text-xs text-chrome-muted">
        <span className="flex items-center gap-1">
          <TrendingUp size={13} className="text-crt-green" />
          Win pays £{5 + ROUND_INCOME + projectedInterest + streakBonus(streak + 1) - wage + wager}M
        </span>
        <span>
          interest +£{projectedInterest}M{wage > 0 && ` · wages −£${wage}M`}
        </span>
      </div>

      {/* Gaffer's Gamble */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-crt-amber/30 bg-crt-amber/5 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-xs text-crt-amber">
          <Dice5 size={14} />
          {wager > 0 ? `Stake £${wager}M (win +£${wager} / lose −£${wager})` : "Gaffer's Gamble"}
        </span>
        <div className="flex gap-1">
          {[
            { label: 'None', amt: 0 },
            { label: '¼', amt: Math.floor(bankroll / 4) },
            { label: 'Max', amt: maxWager(bankroll) },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setWager(b.amt)}
              data-testid={`wager-${b.label === '¼' ? 'quarter' : b.label.toLowerCase()}`}
              className="rounded border border-white/15 px-1.5 py-0.5 text-[11px] hover:bg-white/5"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {lastIncome && (
        <p className="mb-3 text-[11px] text-crt-green/80">
          Last round: {netLast >= 0 ? '+' : '−'}£{Math.abs(netLast)}M (£{lastIncome.reward} result · £
          {lastIncome.income} round · £{lastIncome.interest} int · £{lastIncome.streak} streak
          {lastIncome.wage ? ` · −£${lastIncome.wage} wages` : ''}
          {lastIncome.wager ? ` · ${lastIncome.wager > 0 ? '+' : '−'}£${Math.abs(lastIncome.wager)} bet` : ''})
        </p>
      )}

      <motion.button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        whileTap={canPlay ? { scale: 0.98 } : undefined}
        data-testid="play-round"
        className={[
          'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-display text-lg transition',
          canPlay
            ? 'border border-crt-green/50 bg-crt-green/20 text-crt-green hover:bg-crt-green/30 shadow-glow'
            : 'cursor-not-allowed border border-white/10 bg-white/5 text-chrome-muted',
        ].join(' ')}
      >
        <Play size={18} />
        {canPlay ? `Play Round ${round}` : 'Field a team first'}
      </motion.button>
    </div>
  );
}
