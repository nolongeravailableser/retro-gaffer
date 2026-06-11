import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronsRight, Trophy, Ban, HeartCrack, Tv, AlignLeft, Volume2, VolumeX,
  Megaphone, ArrowLeftRight, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  simulateSegment,
  finalizeResult,
  freshCarry,
  applyInjuryPenalty,
  kickoffEvent,
  halfTimeEvent,
  fullTimeEvent,
  KICKOFF,
  HALFTIME,
  FULLTIME,
  DEFAULT_TUNING,
  type MatchTeam,
  type EngineTuning,
  type MatchCarry,
} from '@/lib/engine';
import { TEAM_TALKS, applyTalk, aiTalkFor, type TeamTalk } from '@/lib/teamtalk';
import { generateOpponent } from '@/lib/opponent';
import { buildVizTimeline } from '@/lib/matchviz';
import { resolveKits, DEFAULT_KIT } from '@/lib/kits';
import { playCue, isMuted, setMuted, type SoundCue } from '@/lib/sound';
import { MATCH_REWARD } from '@/lib/economy';
import { useGameStore } from '@/store/useGameStore';
import MatchPitchView from './MatchPitchView';
import MatchReport from './MatchReport';
import type { RatingContext } from '@/lib/ratings';
import CrestBadge from '@/components/ui/CrestBadge';
import type { MatchResult, MatchEvent, Player } from '@/lib/types';

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
  /** Interactive matches pause for decisions (half-time talk, substitutions). */
  interactive?: boolean;
  /** Fit bench players who could come on after an injury. */
  benchPlayers?: Player[];
  /** Recompute side-A strengths for a substituted XI (chemistry + round mods). */
  rebuildStrength?: (starters: Player[]) => { attack: number; defense: number };
  onComplete: (result: MatchResult) => void;
}

const SPEEDS = [0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

// ms between events. 0.5× is the "immersive" pace; 1× is the calm default
// (a touch slower than before, per playtester feedback that matches felt rushed).
const SPEED_DELAY: Record<Speed, number> = { 0.5: 1000, 1: 650, 2: 280, 4: 80 };

// A player fielded out of his role plays at 90% of his ATK/DEF.
const OUT_OF_POSITION = 0.9;

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

type Pause = { type: 'halftime' } | { type: 'injury'; playerId: string };

/**
 * A match in flight. Interactive matches are simulated in SEGMENTS that pause
 * at half-time (team talk) and on side-A injuries (substitution window); the
 * event list grows as decisions are made. Non-interactive (PvP) runs straight
 * through the same machinery with no pauses.
 */
interface LiveMatch {
  teamA: MatchTeam;
  opponent: MatchTeam;
  seed: string;
  events: MatchEvent[];
  carry: MatchCarry;
  /** First minute not yet simulated (91 = done). */
  nextMinute: number;
  talkDone: boolean;
  xg: { a: number; b: number };
  pause: Pause | null;
  /** Set once the 90 minutes are complete. */
  result: MatchResult | null;
}

/** Run segments until the next decision point (or full-time). Pure. */
function advance(lm: LiveMatch, interactive: boolean, tuning: EngineTuning): LiveMatch {
  let { events, carry, nextMinute, xg, talkDone } = lm;
  events = [...events];
  while (nextMinute <= 90) {
    if (nextMinute === 46 && !talkDone) {
      events.push(halfTimeEvent());
      talkDone = true;
      if (interactive) {
        return { ...lm, events, carry, nextMinute, xg, talkDone, pause: { type: 'halftime' } };
      }
    }
    const to = nextMinute <= 45 ? 45 : 90;
    const seg = simulateSegment(lm.teamA, lm.opponent, lm.seed, tuning, nextMinute, to, carry, interactive);
    events.push(...seg.events);
    carry = seg.carry;
    nextMinute = seg.nextMinute;
    xg = { a: xg.a + seg.xg.a, b: xg.b + seg.xg.b };
    if (seg.stop === 'injury') {
      return {
        ...lm, events, carry, nextMinute, xg, talkDone,
        pause: { type: 'injury', playerId: carry.injuredId! },
      };
    }
  }
  events.push(fullTimeEvent());
  const result = finalizeResult(events, carry, xg);
  return { ...lm, events, carry, nextMinute, xg, talkDone, pause: null, result };
}

export default function MatchView({
  open,
  onClose,
  playerTeam,
  opponent: opponentOverride = null,
  seed: seedProp = null,
  tuning = DEFAULT_TUNING,
  ladder = false,
  interactive = false,
  benchPlayers = [],
  rebuildStrength,
  onComplete,
}: MatchViewProps) {
  const lastIncome = useGameStore((s) => s.lastIncome);
  const bankroll = useGameStore((s) => s.bankroll);
  const playerKit = useGameStore((s) => s.kit);
  const [live, setLive] = useState<LiveMatch | null>(null);
  const [shown, setShown] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  /** 2D pitch view (default) vs. the full text ticker. */
  const [pitchMode, setPitchMode] = useState(true);
  const [ratingsOpen, setRatingsOpen] = useState(true);
  const [muted, setMutedState] = useState(isMuted);
  const completedRef = useRef(false);
  const tickerRef = useRef<HTMLDivElement>(null);
  // Mirrors + suspension slot: closing mid-match SUSPENDS it (state kept here)
  // so reopening the same fixture resumes at the same minute, decisions intact.
  const liveRef = useRef<LiveMatch | null>(null);
  const shownRef = useRef(0);
  const suspendedRef = useRef<{ seed: string; live: LiveMatch; shown: number } | null>(null);
  liveRef.current = live;
  shownRef.current = shown;

  // Latest inputs in refs so the build effect can read them WITHOUT re-running
  // when their identity changes mid-match. (A resolved round mutates roundMods,
  // which gives playerTeam a new reference; depending on it here used to restart
  // the sim and re-fire onComplete in a loop that auto-advanced the whole run.)
  const playerTeamRef = useRef(playerTeam);
  const opponentRef = useRef(opponentOverride);
  const tuningRef = useRef(tuning);
  const interactiveRef = useRef(interactive);
  const benchRef = useRef(benchPlayers);
  const rebuildRef = useRef(rebuildStrength);
  playerTeamRef.current = playerTeam;
  opponentRef.current = opponentOverride;
  tuningRef.current = tuning;
  interactiveRef.current = interactive;
  benchRef.current = benchPlayers;
  rebuildRef.current = rebuildStrength;

  // Build the match once per open, or when a genuinely new match is requested
  // (new seed) — never on an incidental playerTeam re-render.
  useEffect(() => {
    if (!open) {
      // Suspend an unfinished match so the same fixture can resume; a
      // finished one is spent (the round resolved on completion).
      const lm = liveRef.current;
      if (lm && !lm.result) {
        suspendedRef.current = { seed: lm.seed, live: lm, shown: shownRef.current };
      }
      setLive(null);
      completedRef.current = false;
      return;
    }
    const pt = playerTeamRef.current;
    if (!pt) return;
    const seed = seedProp ?? `M-${Date.now()}`;
    // Resume a suspended match for the SAME fixture (a new run/round changes
    // the seed, which discards the suspension).
    const suspended = suspendedRef.current;
    if (suspended && suspended.seed === seed) {
      suspendedRef.current = null;
      completedRef.current = false;
      setLive(suspended.live);
      setShown(suspended.shown);
      setSpeed(1);
      return;
    }
    suspendedRef.current = null;
    const opponent = opponentRef.current ?? generateOpponent(pt.attack, pt.defense, seed);
    const start: LiveMatch = {
      teamA: pt,
      opponent,
      seed,
      events: [kickoffEvent()],
      carry: freshCarry(),
      nextMinute: 1,
      talkDone: false,
      xg: { a: 0, b: 0 },
      pause: null,
      result: null,
    };
    completedRef.current = false;
    setLive(advance(start, interactiveRef.current, tuningRef.current));
    setShown(1);
    setSpeed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedProp]);

  // Drive playback. When the cursor catches up with the known events, either a
  // decision overlay is showing (pause), or the match is finished (complete).
  useEffect(() => {
    if (!live) return;
    if (shown >= live.events.length) {
      if (live.result && !completedRef.current) {
        completedRef.current = true;
        onComplete(live.result);
      }
      return;
    }
    const id = setTimeout(() => setShown((c) => c + 1), SPEED_DELAY[speed]);
    return () => clearTimeout(id);
  }, [live, shown, speed, onComplete]);

  // Auto-scroll the ticker.
  useEffect(() => {
    const el = tickerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, live?.pause]);

  // Retro sound cue for the event that just appeared. Whistle beats key on the
  // engine's canonical TEXTS (a sub/talk flavour at minute 45 is not half-time)
  // and fast playback thins the soundscape so 4× doesn't machine-gun blips.
  useEffect(() => {
    if (!live || shown === 0) return;
    const e = live.events[shown - 1];
    if (!e) return;
    let cue: SoundCue | null =
      e.kind === 'goal' || e.kind === 'chance' || e.kind === 'yellow' ||
      e.kind === 'red' || e.kind === 'injury'
        ? e.kind
        : e.text === KICKOFF
          ? 'kickoff'
          : e.text === HALFTIME || e.text === FULLTIME
            ? 'whistle'
            : null;
    // Speed gating: 2× drops the chance blips; 4× keeps only the big moments.
    if (speed >= 2 && cue === 'chance') cue = null;
    if (speed >= 4 && cue !== 'goal' && cue !== 'red' && cue !== 'whistle') cue = null;
    if (cue) playCue(cue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, shown]);

  // Half-time decision: bounded multipliers on side A for the second half.
  // The OPPONENT responds too — score-derived and deterministic (aiTalkFor),
  // so chasing teams attack and protecting teams park, readably.
  const decideTalk = (talk: TeamTalk) =>
    setLive((lm) => {
      if (!lm || lm.pause?.type !== 'halftime') return lm;
      const teamA = applyTalk(lm.teamA, talk);
      const aiTalk = aiTalkFor(lm.carry.goalsB, lm.carry.goalsA);
      const opponent = aiTalk ? applyTalk(lm.opponent, aiTalk) : lm.opponent;
      const events = [...lm.events];
      if (talk.id !== 'steady') {
        events.push({
          minute: 46,
          side: 'A' as const,
          kind: 'flavour' as const,
          text: `📣 The gaffer's orders: ${talk.name.toLowerCase()}!`,
        });
      }
      if (aiTalk) {
        events.push({
          minute: 46,
          side: 'B' as const,
          kind: 'flavour' as const,
          text: `📣 ${lm.opponent.name} respond: ${aiTalk.name.toLowerCase()}!`,
        });
      }
      return advance({ ...lm, teamA, opponent, events, pause: null }, true, tuningRef.current);
    });

  // Substitution decision: replace the injured player (no strength penalty,
  // recomputed chemistry) or play on with the knock (penalty applies).
  const decideSub = (subId: string | null) =>
    setLive((lm) => {
      const pause = lm?.pause;
      if (!lm || pause?.type !== 'injury') return lm;
      if (!subId) {
        return advance(
          { ...lm, carry: applyInjuryPenalty(lm.carry), pause: null },
          true,
          tuningRef.current
        );
      }
      const sub = benchRef.current.find((p) => p.id === subId);
      const injured = lm.teamA.squad.find((p) => p.id === pause.playerId);
      if (!sub || !injured) return advance({ ...lm, carry: applyInjuryPenalty(lm.carry), pause: null }, true, tuningRef.current);
      // Out of position → field a −10% clone (keeps the persisted player intact;
      // rebuildStrength reads these stats, so the team gets correctly weaker).
      const outOfPosition = sub.role !== injured.role;
      const fielded: Player = outOfPosition
        ? {
            ...sub,
            stats: {
              attack: Math.round(sub.stats.attack * OUT_OF_POSITION),
              defense: Math.round(sub.stats.defense * OUT_OF_POSITION),
            },
          }
        : sub;
      const starters = lm.teamA.squad.map((p) => (p.id === injured.id ? fielded : p));
      const strengths = rebuildRef.current
        ? rebuildRef.current(starters)
        : { attack: lm.teamA.attack, defense: lm.teamA.defense };
      const teamA: MatchTeam = { name: lm.teamA.name, squad: starters, ...strengths };
      const events = [...lm.events, {
        minute: Math.max(1, lm.nextMinute - 1),
        side: 'A' as const,
        kind: 'flavour' as const,
        text:
          `🔁 Substitution: ${sub.name} replaces ${injured.name}.` +
          (outOfPosition ? ` Out of position (${injured.role}) — playing at 90%.` : ''),
      }];
      return advance({ ...lm, teamA, events, pause: null }, true, tuningRef.current);
    });

  // Choreograph the 2D pitch. Prefix-stable as events stream in (the viz RNG
  // is consumed per event in order), so already-played scenes never change.
  const timeline = useMemo(
    () =>
      live
        ? buildVizTimeline(live.events, live.seed, live.teamA.squad, live.opponent.squad, 0.5)
        : null,
    [live]
  );

  // What both sides wear — clash-resolved so the teams always read distinctly.
  const kits = useMemo(
    () => resolveKits(playerKit ?? DEFAULT_KIT, live?.opponent.name ?? ''),
    [playerKit, live?.opponent.name]
  );

  if (!open || !playerTeam || !live) return null;

  const { opponent, result } = live;
  const events = live.events;
  const visible = events.slice(0, shown);
  const caughtUp = shown >= events.length;

  const scoreA = visible.filter((e) => e.kind === 'goal' && e.side === 'A').length;
  const scoreB = visible.filter((e) => e.kind === 'goal' && e.side === 'B').length;
  const currentMinute = visible.at(-1)?.minute ?? 0;
  const progressPct = Math.min(100, Math.round((currentMinute / 90) * 100));

  const finished = !!result && caughtUp;
  const pauseActive = !result && caughtUp ? live.pause : null;
  const outcome = result ? OUTCOME_COPY[result.outcome] : null;
  const xgShown = result ? result.xg : { a: Math.round(live.xg.a * 100) / 100, b: Math.round(live.xg.b * 100) / 100 };
  const payoutNet = lastIncome
    ? lastIncome.reward + lastIncome.income + lastIncome.interest +
      lastIncome.streak - lastIncome.wage - lastIncome.upkeep + lastIncome.wager
    : 0;

  const hasSuspensions = !!result && result.suspensions.length > 0;
  const hasInjuries = !!result && result.injuries.length > 0;
  const hasTeamNews = hasSuspensions || hasInjuries;

  // Post-match numbers, straight from the event log.
  const count = (side: 'A' | 'B', kinds: string[]) =>
    events.filter((e) => e.side === side && kinds.includes(e.kind)).length;
  const matchStats: { label: string; a: number; b: number }[] = result
    ? [
        { label: 'Shots', a: count('A', ['goal', 'chance']), b: count('B', ['goal', 'chance']) },
        { label: 'Goals', a: result.score.a, b: result.score.b },
        { label: 'Cards', a: count('A', ['yellow', 'red']), b: count('B', ['yellow', 'red']) },
      ]
    : [];

  const playerName = (id: string) =>
    live.teamA.squad.find((p) => p.id === id)?.name ??
    playerTeam.squad.find((p) => p.id === id)?.name ??
    id;

  // Ratings read from the events shown SO FAR (so they update live). The outcome
  // is provisional until full-time, derived from the score on screen.
  const ratingCtx: RatingContext = {
    goalsConceded: scoreB,
    outcome: scoreA > scoreB ? 'win' : scoreA < scoreB ? 'loss' : 'draw',
    seed: live.seed,
  };

  // Substitution candidates: same role, fit, not already on the pitch.
  const injuredPlayer =
    pauseActive?.type === 'injury'
      ? live.teamA.squad.find((p) => p.id === pauseActive.playerId) ?? null
      : null;
  const squadIds = new Set(live.teamA.squad.map((p) => p.id));
  // Any fit bench player can come on (not just like-for-like) — that was the
  // "can't sub when injured" complaint. Same-role cover is listed first; an
  // out-of-position sub plays at −10% (applied in decideSub).
  const subCandidates = injuredPlayer
    ? benchPlayers
        .filter((p) => !squadIds.has(p.id))
        .sort((a, b) => {
          const fit = (p: Player) => (p.role === injuredPlayer.role ? 0 : 1);
          return (
            fit(a) - fit(b) ||
            b.stats.attack + b.stats.defense - (a.stats.attack + a.stats.defense)
          );
        })
    : [];

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
            <span className="flex min-w-0 items-center justify-center gap-1.5">
              <CrestBadge name={playerTeam.name} kit={kits.a} size={20} />
              <span className="truncate font-display text-lg">{playerTeam.name}</span>
            </span>

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

            <span className="flex min-w-0 items-center justify-center gap-1.5">
              <span className="truncate font-display text-lg">{opponent.name}</span>
              <CrestBadge name={opponent.name} kit={kits.b} size={20} />
            </span>
          </div>

          {/* xG row + status */}
          <div className="mt-1 grid grid-cols-3 text-center text-[11px] text-chrome-muted">
            <span>xG {xgShown.a.toFixed(2)}</span>
            <span className="flex items-center justify-center gap-1.5">
              {finished ? (
                <span className="font-display uppercase tracking-wide">Full-Time</span>
              ) : pauseActive ? (
                <span className="font-display uppercase tracking-wide text-crt-amber">
                  {pauseActive.type === 'halftime' ? 'Half-Time' : 'Play stopped'}
                </span>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                  <span>{currentMinute}'</span>
                </>
              )}
            </span>
            <span>xG {xgShown.b.toFixed(2)}</span>
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

        {/* ── Action area: 2D pitch + caption feed, or the full ticker ── */}
        <div
          ref={tickerRef}
          className="flex-1 space-y-1.5 overflow-y-auto bg-pitch-950 px-5 py-4 font-ticker text-base leading-snug"
        >
          {pitchMode && timeline && (
            <MatchPitchView
              timeline={timeline}
              shown={shown}
              speedDelay={SPEED_DELAY[speed]}
              finished={finished}
              kitA={kits.a}
              kitB={kits.b}
            />
          )}

          {pitchMode && timeline
            ? // Compact caption feed under the pitch — the last few beats.
              !finished &&
              visible.slice(-3).map((e, i) => (
                <p key={Math.max(0, shown - 3) + i} className={`${eventClass(e.kind)} text-sm`}>
                  {e.minute > 0 && e.kind !== 'flavour' && (
                    <span className="text-chrome-muted">{e.minute}' </span>
                  )}
                  {e.text}
                </p>
              ))
            : visible.map((e, i) => (
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

          {/* Live player ratings — visible during play, collapsible. */}
          {!finished && shown > 1 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setRatingsOpen((o) => !o)}
                className="mb-1 flex w-full items-center justify-between rounded-md border border-white/10 bg-pitch-900/60 px-2 py-1 text-[11px] text-chrome-muted transition hover:text-chrome"
              >
                <span className="font-display uppercase tracking-wide">Live player ratings</span>
                {ratingsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {ratingsOpen && (
                <MatchReport
                  events={visible}
                  squad={live.teamA.squad}
                  ctx={ratingCtx}
                  teamAName={live.teamA.name}
                  finished={false}
                />
              )}
            </div>
          )}

          {/* ── Decision windows ── */}
          <AnimatePresence>
            {pauseActive?.type === 'halftime' && (
              <motion.div
                key="talk"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 rounded-lg border border-crt-amber/40 bg-crt-amber/10 px-4 py-3"
              >
                <p className="mb-2 flex items-center gap-2 font-display text-sm uppercase tracking-wide text-crt-amber">
                  <Megaphone size={15} /> Half-time team talk — {scoreA}:{scoreB}
                </p>
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  {TEAM_TALKS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => decideTalk(t)}
                      data-testid={`talk-${t.id}`}
                      className="flex flex-1 flex-col rounded-lg border border-white/15 bg-pitch-900/60 px-3 py-2 text-left transition hover:border-crt-amber/60 hover:bg-crt-amber/10"
                    >
                      <span className="font-display text-sm text-chrome">
                        {t.emoji} {t.name}
                      </span>
                      <span className="text-[11px] text-chrome-muted">{t.blurb}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {pauseActive?.type === 'injury' && injuredPlayer && (
              <motion.div
                key="sub"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 rounded-lg border border-orange-400/40 bg-orange-500/10 px-4 py-3"
              >
                <p className="mb-2 flex items-center gap-2 font-display text-sm uppercase tracking-wide text-orange-300">
                  <ArrowLeftRight size={15} /> {injuredPlayer.name} can't continue
                </p>
                <div className="flex flex-col gap-1.5">
                  {subCandidates.map((p) => {
                    const offRole = p.role !== injuredPlayer.role;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => decideSub(p.id)}
                        data-testid={`sub-${p.id}`}
                        className="flex items-center justify-between rounded-lg border border-white/15 bg-pitch-900/60 px-3 py-2 text-left transition hover:border-crt-green/60 hover:bg-crt-green/10"
                      >
                        <span className="font-display text-sm text-chrome">
                          🔁 Bring on {p.name}
                        </span>
                        <span className="text-[11px] text-chrome-muted">
                          {p.role} · ATK {p.stats.attack} · DEF {p.stats.defense}
                          {offRole && (
                            <span className="text-crt-amber"> · −10% out of position</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => decideSub(null)}
                    data-testid="sub-none"
                    className="rounded-lg border border-white/15 bg-pitch-900/60 px-3 py-2 text-left text-sm text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
                  >
                    {subCandidates.length
                      ? 'No substitution — play on with the knock'
                      : 'No fit cover on the bench — play on with the knock'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {finished && result && outcome && (
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

                {/* Match stats — shots / goals / cards from the event log */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {matchStats.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg border border-white/10 bg-pitch-900/60 px-2 py-1.5 text-center"
                    >
                      <p className="text-[10px] uppercase tracking-wide text-chrome-muted">{s.label}</p>
                      <p className="font-display text-sm text-chrome">
                        <span className="text-crt-green">{s.a}</span>
                        <span className="text-chrome-muted"> · </span>
                        <span>{s.b}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Key-events timeline + player ratings */}
                <MatchReport
                  events={events}
                  squad={live.teamA.squad}
                  ctx={{ goalsConceded: result.score.b, outcome: result.outcome, seed: live.seed }}
                  teamAName={live.teamA.name}
                  finished
                />

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
                      {lastIncome.upkeep ? ` · −£${lastIncome.upkeep} upkeep` : ''}
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
          <span className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPitchMode((v) => !v)}
              data-testid="toggle-pitch-view"
              title={pitchMode ? 'Switch to the full text ticker' : 'Switch to the 2D pitch view'}
              className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 font-display text-xs text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
            >
              {pitchMode ? <AlignLeft size={13} /> : <Tv size={13} />}
              <span className="hidden sm:inline">{pitchMode ? 'Ticker' : 'Pitch'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                setMutedState(next);
              }}
              data-testid="toggle-sound"
              title={muted ? 'Unmute match sounds' : 'Mute match sounds'}
              className="flex items-center rounded-md border border-white/15 px-2 py-1 text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <span className="hidden font-ticker text-[11px] text-chrome-muted sm:inline">
              seed {live.seed}
            </span>
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

              {/* Instant: jump to the next decision point (or full-time) */}
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
