import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Flame, Trophy, Play, RotateCcw, Swords, TrendingUp, Crown, Share2, Check, Dice5,
  ShieldCheck, HeartPulse, Briefcase,
} from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import {
  ladderTier,
  bestLabel,
  interest,
  streakBonus,
  wageBill,
  maxWager,
  lifeBuybackCost,
} from '@/lib/ladder';
import { getMutator } from '@/lib/mutators';
import { runConfig, getScenario } from '@/lib/scenarios';
import { boardWantsTitle } from '@/lib/career';
import { runScore, formatScore } from '@/lib/score';
import { MATCH_REWARD } from '@/lib/economy';
import Stars from '@/components/ui/Stars';
import { formatRunResult } from '@/lib/daily';
import { getBoss } from '@/lib/bosses';
import type { MatchTeam } from '@/lib/engine';
import { XI_SIZE } from '@/lib/types';

interface SeasonPanelProps {
  /** This round's opponent (for the preview), or null if no XI fielded. */
  roundOpponent: MatchTeam | null;
  canPlay: boolean;
  /** How many of the XI's 11 slots are currently filled (for the CTA hint). */
  filled: number;
  /** Hide the panel's own play button when the journey bar owns kick-off. */
  hidePlay?: boolean;
  onPlay: () => void;
}

export default function SeasonPanel({ roundOpponent, canPlay, filled, hidePlay = false, onPlay }: SeasonPanelProps) {
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
  const mutatorId = useGameStore((s) => s.mutator);
  const mode = useGameStore((s) => s.mode);
  const scenarioId = useGameStore((s) => s.scenario);
  const scenarioStars = useGameStore((s) => s.scenarioStars);
  const config = runConfig({ scenario: scenarioId, mode, mutator: mutatorId });
  const { maxRounds, startingLives } = config;
  const mutator = getMutator(mutatorId);
  const scenario = getScenario(scenarioId);
  const career = useGameStore((s) => s.career);
  const careerBest = useGameStore((s) => s.careerBest);
  const clubName = useGameStore((s) => s.clubName);
  const startRun = useGameStore((s) => s.startRun);
  const startScenario = useGameStore((s) => s.startScenario);
  const startCareer = useGameStore((s) => s.startCareer);
  const newDailyRun = useGameStore((s) => s.newDailyRun);
  const [shared, setShared] = useState(false);

  // Mode-aware "play it again": restart the same thing that just ended.
  const replay = () => {
    if (scenarioId) startScenario(scenarioId);
    else if (career) startCareer();
    else if (daily) newDailyRun();
    else startRun(mode, mutatorId);
  };
  const replayLabel = scenarioId
    ? 'Retry Challenge'
    : career
      ? 'New Career'
      : daily
        ? 'Replay Daily'
        : mode === 'endless'
          ? 'New Endless Run'
          : 'New Run';

  if (runStatus !== 'playing') {
    const won = runStatus === 'won';
    const scored = config.scored || daily !== null;
    const reached = won ? maxRounds : round;
    const isNewBest = reached >= best.round;
    const squadValue = owned.reduce((sum, id) => sum + (getPlayer(id)?.cost ?? 0), 0);
    const score = runScore({ round, runStatus, peakBankroll, bestStreak, record, maxRounds });
    const stats: [string, string][] = [
      ...(scored ? ([['Score', formatScore(score)]] as [string, string][]) : []),
      ...(career
        ? ([['Seasons survived', `${Math.max(careerBest, career.season - 1)}`]] as [string, string][])
        : []),
      ['Reached', won ? 'Champions League winner' : `Round ${round} · ${ladderTier(round)}`],
      ['Record', `${record.w}W · ${record.d}D · ${record.l}L`],
      ['Best streak', `${bestStreak} wins`],
      ['Peak bankroll', `£${peakBankroll}M`],
      ...(mutator ? ([['Modifier', `${mutator.emoji} ${mutator.name}`]] as [string, string][]) : [['Squad value', `£${squadValue}M`] as [string, string]]),
      ['Career best', bestLabel(best.round)],
    ];
    // Framing/heading depends on the run type: scenario, endless (scored), classic.
    const frame = won
      ? 'border-crt-green/50 bg-crt-green/10'
      : config.scored
        ? 'border-crt-amber/50 bg-crt-amber/10'
        : 'border-rose-400/50 bg-rose-500/10';
    const accent = won ? 'text-crt-green' : config.scored ? 'text-crt-amber' : 'text-rose-300';
    const heading = career
      ? 'SACKED — CAREER OVER'
      : scenario
        ? won
          ? 'CHALLENGE COMPLETE'
          : 'CHALLENGE FAILED'
        : won
          ? 'CHAMPIONS OF EUROPE!'
          : config.scored
            ? 'RUN OVER'
            : 'SACKED BY THE BOARD';
    return (
      <div className={`rounded-xl border p-5 ${frame}`}>
        <div className="text-center">
          <Trophy size={32} className={`mx-auto mb-2 ${accent}`} />
          <h2 className="font-display text-2xl">{heading}</h2>
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
          {!scenario && isNewBest && best.round > 0 && (
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
                clubName,
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
            onClick={replay}
            data-testid="new-season"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 font-display text-sm hover:bg-white/5"
          >
            <RotateCcw size={14} /> {replayLabel}
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
  const boss = getBoss(round, config.bosses);

  // Explicit win/draw/loss payouts so the stake's consequences are visible
  // BEFORE pressing Play (matches the resolveRound formula in the store).
  const base = config.roundIncome + projectedInterest - wage;
  const winPay = MATCH_REWARD.win + base + streakBonus(streak + 1) + wager;
  const drawPay = MATCH_REWARD.draw + base;
  const lossPay = MATCH_REWARD.loss + base - wager;
  const money = (n: number) => `${n >= 0 ? '+' : '−'}£${Math.abs(n)}M`;
  // The real cost of a loss is a life (more on some bosses), unless shielded.
  const lifeCost = shield ? 0 : boss?.lifeCost ?? 1;

  return (
    <div
      className={`rounded-xl border p-4 ${
        boss ? 'border-fuchsia-400/50 bg-fuchsia-500/5' : 'border-white/10 bg-pitch-900/70'
      }`}
    >
      {scenario && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-crt-green/30 bg-crt-green/10 px-3 py-2">
          <span>{scenario.emoji}</span>
          <span className="flex-1 text-xs text-crt-green">
            <span className="font-display">{scenario.name}</span> — {scenario.objective}
          </span>
          <Stars earned={scenarioStars[scenario.id] ?? 0} size={12} />
        </div>
      )}
      {career && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-crt-green/30 bg-crt-green/10 px-3 py-2 text-xs text-crt-green">
          <Briefcase size={13} className="shrink-0" />
          <span className="flex-1">
            <span className="font-display">Season {career.season}</span> — the board demand you{' '}
            {boardWantsTitle(career.season) ? (
              <><span className="font-display">win the title</span>. Anything less and you're sacked.</>
            ) : (
              <>reach <span className="font-display">{ladderTier(career.targetRound)}</span> (round{' '}
              {career.targetRound}). Go out before that and you're sacked.</>
            )}
          </span>
        </div>
      )}
      {/* Active ruleset — readable without hovering a HUD chip */}
      {!scenario && !career && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-display text-chrome">
            {config.name}
          </span>
          {daily && (
            <span className="rounded border border-fuchsia-400/30 px-1.5 py-0.5 text-fuchsia-200">
              Daily {daily}
            </span>
          )}
          {mutator && (
            <span
              className="rounded border border-amber-400/30 px-1.5 py-0.5 text-amber-200"
              title={mutator.blurb}
            >
              {mutator.emoji} {mutator.name}
            </span>
          )}
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-chrome-muted">
            Round {round}/{Number.isFinite(maxRounds) ? maxRounds : '∞'}
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
            {Array.from({ length: Math.max(startingLives, lives) }, (_, i) => (
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
      {lives < startingLives && (
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

      {/* Match Stakes — explicit outcome payouts */}
      <div className="mb-3 rounded-lg border border-white/10 bg-pitch-800/50 px-3 py-2.5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-display uppercase tracking-wide text-chrome-muted">
          <TrendingUp size={13} className="text-crt-green" />
          Match Stakes
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-crt-green/30 bg-crt-green/10 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Win</p>
            <p className="font-display text-sm text-crt-green">{money(winPay)}</p>
          </div>
          <div className="rounded-md border border-crt-amber/30 bg-crt-amber/10 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Draw</p>
            <p className="font-display text-sm text-crt-amber">{money(drawPay)}</p>
          </div>
          <div className="rounded-md border border-rose-400/30 bg-rose-500/10 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Loss</p>
            <p className="font-display text-sm text-rose-300">{money(lossPay)}</p>
            <p className="text-[9px] text-rose-300/70">
              {lifeCost === 0 ? 'shield holds' : `−${lifeCost} ${lifeCost > 1 ? 'lives' : 'life'}`}
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-right text-[10px] text-chrome-muted">
          incl. +£{projectedInterest}M interest{wage > 0 && ` · −£${wage}M wages`}
          {streak > 0 && ` · +£${streakBonus(streak + 1)}M streak on win`}
        </p>
      </div>

      {/* Gaffer's Gamble */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-crt-amber/30 bg-crt-amber/5 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-xs text-crt-amber">
          <Dice5 size={14} />
          {wager > 0 ? `Staking £${wager}M` : "Gaffer's Gamble"}
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
              className={[
                'rounded border px-1.5 py-0.5 text-[11px] transition',
                (b.label === 'None' ? wager === 0 : wager === b.amt && b.amt > 0)
                  ? 'border-crt-amber/60 bg-crt-amber/20 text-crt-amber'
                  : 'border-white/15 hover:bg-white/5',
              ].join(' ')}
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

      {/* The journey bar shows an identical kick-off CTA right above this
          panel when the XI is ready — one primary action, not two stacked. */}
      {!hidePlay && (
      <motion.button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        title={canPlay ? undefined : `Fill all ${XI_SIZE} starting slots before kickoff (${filled}/${XI_SIZE})`}
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
        {canPlay ? `Play Round ${round}` : `Fill your XI (${filled}/${XI_SIZE})`}
      </motion.button>
      )}
    </div>
  );
}
