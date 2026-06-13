import { useState } from 'react';
import {
  Heart, Flame, Dice5, ShieldCheck, HeartPulse, Briefcase, Minus, Plus,
} from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import {
  ladderTier, interest, streakBonus, maxWager, lifeBuybackCost,
} from '@/lib/ladder';
import {
  wageBill, divisionMult, tierMult, wageTierMult, wageBudget, LEAGUE_NEUTRAL_TIER,
} from '@/lib/wages';
import { matchdayIncome, facilityUpkeep } from '@/lib/stadium';
import { opponentBriefing } from '@/lib/briefing';
import type { Player } from '@/lib/types';
import { getMutator } from '@/lib/mutators';
import { runConfig, getScenario } from '@/lib/scenarios';
import {
  division, totalWeeks, table, YOU,
  TOP_TIER, BOTTOM_TIER, PROMOTION_SPOTS, RELEGATION_SPOTS,
} from '@/lib/league';
import { roundName as cupRoundName, careerCupDue } from '@/lib/cup';
import { MATCH_REWARD } from '@/lib/economy';
import { getBoss } from '@/lib/bosses';
import { resolveKits, DEFAULT_KIT } from '@/lib/kits';
import CrestBadge from '@/components/ui/CrestBadge';
import Stars from '@/components/ui/Stars';
import type { MatchTeam } from '@/lib/engine';

interface FixtureHeroProps {
  /** This round's opponent (for the preview), or null if no XI fielded. */
  roundOpponent: MatchTeam | null;
  /** Your effective side (chemistry/mods applied) — drives the edge bar. */
  playerTeam: MatchTeam | null;
}

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? 'th';
  return `${n}${s}`;
};

/**
 * The Home hero: the next fixture as the centre of gravity — who you play,
 * whether you're favoured (in words, not raw numbers), what's at stake, and
 * the wager. The sticky JourneyBar directly above owns the kick-off CTA
 * (design-mockups/01-home-matchday.html + 10-cup-week.html).
 */
export default function FixtureHero({ roundOpponent, playerTeam }: FixtureHeroProps) {
  const round = useGameStore((s) => s.round);
  const lives = useGameStore((s) => s.lives);
  const streak = useGameStore((s) => s.streak);
  const bankroll = useGameStore((s) => s.bankroll);
  const lastIncome = useGameStore((s) => s.lastIncome);
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
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const cup = useGameStore((s) => s.cup);
  const clubName = useGameStore((s) => s.clubName);
  const kit = useGameStore((s) => s.kit);
  const [mathOpen, setMathOpen] = useState(false);

  const config = runConfig({ scenario: scenarioId, mode, mutator: mutatorId });
  const { maxRounds, startingLives } = config;
  const mutator = getMutator(mutatorId);
  const scenario = getScenario(scenarioId);
  const cupTieDue = !!cup && !!league && !!career && careerCupDue(cup, league.matchweek);
  const standaloneCup = !!cup && !career && !league;
  const knockout = cupTieDue || standaloneCup;
  const draftTournament = mode === 'classic' && !career && !!league;
  const boss = !league && !cup ? getBoss(round, config.bosses) : null;
  const leagueWeeks = league ? totalWeeks(league) : 0;

  // ----- economy (mirrors resolveRound/resolveLeagueRound; same as the old panel) -----
  const projectedInterest = interest(bankroll);
  const dm = league ? tierMult(career ? career.tier : LEAGUE_NEUTRAL_TIER) : divisionMult(round, maxRounds);
  const matchday = league && career ? matchdayIncome(career.facilities.stadium) : 0;
  const wageMult = career ? wageTierMult(career.tier) : 1;
  const wage = Math.round(wageBill(owned.map(getPlayer).filter((p): p is Player => !!p)) * wageMult);
  const upkeep = career ? facilityUpkeep(career.facilities, dm) : 0;
  const budget = wageBudget(bankroll, dm);
  const roundIncomeNow = Math.round(config.roundIncome * dm) + matchday;
  const base = roundIncomeNow + projectedInterest - wage - upkeep;
  const winPay = Math.round(MATCH_REWARD.win * dm) + base + streakBonus(streak + 1) + wager;
  const drawPay = Math.round(MATCH_REWARD.draw * dm) + base;
  const lossPay = Math.round(MATCH_REWARD.loss * dm) + base - wager;
  const money = (n: number) => `${n >= 0 ? '+' : '−'}£${Math.abs(n)}M`;
  const lifeCost = shield ? 0 : boss?.lifeCost ?? 1;
  const netLast = lastIncome
    ? lastIncome.reward + lastIncome.income + lastIncome.interest + lastIncome.streak
      - lastIncome.wage - lastIncome.upkeep - (lastIncome.fine ?? 0) + lastIncome.wager
    : 0;

  // ----- the edge bar: relative strength in words -----
  const you = playerTeam ? playerTeam.attack + playerTeam.defense : 0;
  const them = roundOpponent ? roundOpponent.attack + roundOpponent.defense : 0;
  const r = you + them > 0 ? you / (you + them) : 0.5;
  const verdict =
    r >= 0.62 ? ['clear favourites', 'this should be yours to lose.']
    : r >= 0.54 ? ['slight favourites', 'keep your shape and take your chances.']
    : r > 0.46 ? ['an even contest', 'fine margins — chemistry and form decide it.']
    : r > 0.38 ? ['underdogs', "they're the stronger side on paper."]
    : ['heavy underdogs', 'one off-night is all it takes.'];

  // League context: positions + records from the live table.
  const rows = league ? table(league) : null;
  const yourRow = rows?.find((t) => t.teamId === YOU);
  const yourPos = rows ? rows.findIndex((t) => t.teamId === YOU) + 1 : 0;
  const oppClub =
    league && roundOpponent ? league.clubs.find((c) => c.name === roundOpponent.name) : null;
  const oppRow = oppClub ? rows?.find((t) => t.teamId === oppClub.id) : null;
  const oppPos = oppClub && rows ? rows.findIndex((t) => t.teamId === oppClub.id) + 1 : 0;

  const kits = resolveKits(kit ?? DEFAULT_KIT, roundOpponent?.name ?? 'Opponent');

  // Header line: which competition, which week.
  const headerLabel = knockout && cup
    ? `🏆 ${career ? 'Domestic Cup' : 'The Cup'} · ${cupRoundName(cup.round, cup.rounds)} ${cupTieDue ? '· midweek' : ''}`
    : league
      ? `Matchweek ${Math.min(league.matchweek, leagueWeeks)}/${leagueWeeks} · ${career ? division(career.tier).name : draftTournament ? 'Draft League' : 'League Season'}`
      : `Round ${round}/${Number.isFinite(maxRounds) ? maxRounds : '∞'} · ${ladderTier(round)}${boss ? ' · BOSS' : ''}`;

  return (
    <div
      className={[
        'rounded-2xl border p-4',
        knockout
          ? 'border-crt-amber/50 bg-gradient-to-b from-crt-amber/10 to-surface-1'
          : boss
            ? 'border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-500/10 to-surface-1'
            : 'border-white/10 bg-gradient-to-b from-surface-2 to-surface-1',
      ].join(' ')}
    >
      {/* Context strips */}
      {scenario && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-crt-green/30 bg-crt-green/10 px-3 py-2">
          <span>{scenario.emoji}</span>
          <span className="flex-1 text-xs text-crt-green">
            <span className="font-display">{scenario.name}</span> — {scenario.objective}
          </span>
          <Stars earned={scenarioStars[scenario.id] ?? 0} size={12} />
        </div>
      )}
      {career && !knockout && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-xs text-chrome-muted">
          <Briefcase size={13} className="shrink-0 text-crt-green" />
          <span className="flex-1">
            {career.tier === TOP_TIER ? (
              <>Win the league to be <span className="text-chrome">champions of England</span>; bottom {RELEGATION_SPOTS} go down.</>
            ) : career.tier === BOTTOM_TIER ? (
              <>Top {PROMOTION_SPOTS} promote · bottom {RELEGATION_SPOTS} = <span className="text-rose-300">sacked</span>.</>
            ) : (
              <>Top {PROMOTION_SPOTS} promote · bottom {RELEGATION_SPOTS} relegate.</>
            )}
          </span>
        </div>
      )}
      {!scenario && !career && !league && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-display text-chrome">{config.name}</span>
          {daily && <span className="rounded border border-fuchsia-400/30 px-1.5 py-0.5 text-fuchsia-200">Daily {daily}</span>}
          {mutator && (
            <span className="rounded border border-amber-400/30 px-1.5 py-0.5 text-amber-200" title={mutator.blurb}>
              {mutator.emoji} {mutator.name}
            </span>
          )}
        </div>
      )}

      {/* Header: competition + ladder status icons */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className={`text-[11px] font-display uppercase tracking-widest ${knockout ? 'text-crt-amber' : boss ? 'text-fuchsia-300' : 'text-chrome-muted'}`}>
          {headerLabel}
        </p>
        {!league && (
          <span className="flex items-center gap-2.5">
            {streak > 0 && (
              <span className="flex items-center gap-1 font-data text-sm text-crt-amber"><Flame size={13} />{streak}</span>
            )}
            <span className="flex items-center gap-0.5" aria-label={`${lives} lives`}>
              {Array.from({ length: Math.max(startingLives, lives) }, (_, i) => (
                <Heart key={i} size={13} className={i < lives ? 'fill-rose-400 text-rose-400' : 'text-white/15'} />
              ))}
            </span>
            {shield && (
              <span title="Clean-sheet shield — absorbs your next defeat"><ShieldCheck size={14} className="text-crt-green" /></span>
            )}
          </span>
        )}
      </div>

      {/* Boss rule */}
      {boss && (
        <div className="mb-3 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2">
          <p className="text-sm text-fuchsia-100">{boss.ruleText}</p>
          <div className="mt-1 flex gap-1.5 text-[10px] font-display uppercase tracking-wide">
            {boss.lifeCost > 1 && (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">−{boss.lifeCost} lives on loss</span>
            )}
            {boss.suddenDeath && (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">Sudden death · draw = loss</span>
            )}
          </div>
        </div>
      )}

      {/* The fixture */}
      <div className="my-3 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
          <CrestBadge name={clubName ?? 'Your XI'} kit={kits.a} size={42} />
          <p className="line-clamp-2 w-full font-display text-[15px] leading-tight">{clubName ?? 'Your XI'}</p>
          {yourRow && (
            <p className="font-data text-[10px] text-chrome-muted">
              {ord(yourPos)} · {yourRow.won}W {yourRow.drawn}D {yourRow.lost}L
            </p>
          )}
        </div>
        <span className="shrink-0 font-display text-sm text-chrome-muted/60">VS</span>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
          {roundOpponent ? (
            <>
              <CrestBadge name={roundOpponent.name} kit={kits.b} size={42} />
              <p className="line-clamp-2 w-full font-display text-[15px] leading-tight">{roundOpponent.name}</p>
              {oppRow ? (
                <p className="font-data text-[10px] text-chrome-muted">
                  {ord(oppPos)} · {oppRow.won}W {oppRow.drawn}D {oppRow.lost}L
                </p>
              ) : knockout && career ? (
                <p className="font-data text-[10px] text-chrome-muted">knockout tie</p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-dashed border-white/20 text-chrome-muted">?</div>
              <p className="text-xs text-chrome-muted">Awaiting your XI…</p>
            </>
          )}
        </div>
      </div>

      {/* Edge bar — relative strength, verdict in words */}
      {roundOpponent && playerTeam && (
        <div className="mx-auto mb-3 max-w-md">
          <div className="flex h-2 overflow-hidden rounded-full border border-white/10">
            <div className="bg-crt-green/80" style={{ width: `${Math.round(r * 100)}%` }} />
            <div className="bg-rose-500/70" style={{ width: `${100 - Math.round(r * 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between font-data text-[10px] text-chrome-muted/70">
            <span>YOU {you}</span>
            <span>THEM {them}</span>
          </div>
          <p className="mt-1 text-center text-xs text-chrome-muted">
            You're <span className="font-semibold text-chrome">{verdict[0]}</span> — {verdict[1]}
          </p>
          {/* Scouting report — their threat + the approach that counters it. */}
          {(() => {
            const b = opponentBriefing(roundOpponent);
            return (
              <p className="mt-1.5 text-center text-[11px] leading-snug text-chrome-muted/80">
                <span className="font-data uppercase tracking-wide text-crt-amber/80">Scouting</span>{' '}
                {b.threat} <span className="text-chrome-muted">{b.plan}</span>
              </p>
            );
          })()}
        </div>
      )}

      {/* Stakes */}
      {knockout && cup ? (
        <div className="mb-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border border-crt-green/30 bg-crt-green/5 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Win</p>
            <p className="font-display text-sm text-crt-green">
              {cup.round >= cup.rounds ? 'Lift the Cup 🏆' : `Through to the ${cupRoundName(cup.round + 1, cup.rounds)}`}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-surface-1 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Lose</p>
            <p className="font-display text-sm text-chrome-muted">Out of the cup{cupTieDue ? ' · league unaffected' : ''}</p>
          </div>
          <p className="col-span-2 text-[11px] text-crt-amber/90">
            Glory, not gold — no prize money. A trophy feeds your honours{career ? ' & reputation' : ''}.{' '}
            <span className="font-semibold">Injuries &amp; bans carry{cupTieDue ? ' into the league' : ''}.</span>
          </p>
        </div>
      ) : draftTournament ? (
        <p className="mb-3 rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-center text-xs text-chrome-muted">
          Closed tournament — no bank, no transfers. The table is the only prize: finish 1st of 12.
        </p>
      ) : (
        <div className="mb-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-crt-green/30 bg-crt-green/10 py-2">
              <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Win</p>
              <p className="font-data text-[15px] text-crt-green">{money(winPay)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-surface-1 py-2">
              <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Draw</p>
              <p className="font-data text-[15px] text-chrome">{money(drawPay)}</p>
            </div>
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 py-2">
              <p className="text-[10px] uppercase tracking-wide text-chrome-muted">Loss</p>
              <p className="font-data text-[15px] text-rose-300">{money(lossPay)}</p>
              <p className="text-[9px] text-rose-300/70">
                {league ? 'no points' : lifeCost === 0 ? 'shield holds' : `−${lifeCost} ${lifeCost > 1 ? 'lives' : 'life'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMathOpen((v) => !v)}
            className="mt-1.5 text-xs text-sky-300/90 hover:text-sky-200"
          >
            How is this calculated?{' '}
            <span className="inline-block transition-transform" style={{ transform: mathOpen ? 'rotate(90deg)' : undefined }}>›</span>
          </button>
          {mathOpen && (
            <div className="mt-2 rounded-lg border border-white/10 bg-surface-1 px-3 py-2 font-data text-xs text-chrome-muted">
              <div className="flex justify-between py-0.5"><span>Round income{matchday > 0 ? ' (incl. matchday gate)' : ''}</span><span className="text-crt-green">+£{roundIncomeNow}M</span></div>
              <div className="flex justify-between py-0.5"><span>Bank interest</span><span className="text-crt-green">+£{projectedInterest}M</span></div>
              {streak > 0 && (
                <div className="flex justify-between py-0.5"><span>Win-streak bonus (on a win)</span><span className="text-crt-green">+£{streakBonus(streak + 1)}M</span></div>
              )}
              {wage > 0 && (
                <div className="flex justify-between py-0.5">
                  <span>Wages <span className={wage > budget ? 'text-rose-300' : ''}>(£{wage}M of £{budget}M budget{wage > budget ? ' — over!' : ''})</span></span>
                  <span className="text-rose-300">−£{wage}M</span>
                </div>
              )}
              {upkeep > 0 && (
                <div className="flex justify-between py-0.5"><span>Facility upkeep</span><span className="text-rose-300">−£{upkeep}M</span></div>
              )}
              <div className="flex justify-between border-t border-white/10 py-0.5 pt-1"><span>± result bonus and your stake</span><span /></div>
              {lastIncome && (
                <p className="mt-1 border-t border-white/10 pt-1 text-[11px] text-crt-green/80">
                  Last {league ? 'matchweek' : 'round'}: {netLast >= 0 ? '+' : '−'}£{Math.abs(netLast)}M net
                  {lastIncome.fine ? ` (incl. −£${lastIncome.fine}M fines)` : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Gaffer's Gamble — a stepper, not a 56px text input */}
      {!knockout && !draftTournament && (
        <div className="mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-crt-amber/30 bg-crt-amber/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-crt-amber">
            <Dice5 size={14} />
            Gaffer's Gamble
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center overflow-hidden rounded-lg border border-white/15">
              <button
                type="button"
                onClick={() => setWager(Math.max(0, wager - 1))}
                aria-label="Decrease stake"
                className="flex h-8 w-8 items-center justify-center bg-surface-2 text-chrome hover:bg-surface-3"
              >
                <Minus size={13} />
              </button>
              <input
                type="number"
                min={0}
                max={maxWager(bankroll)}
                value={wager || ''}
                onChange={(e) => setWager(Number(e.target.value))}
                placeholder="£0M"
                aria-label="Custom gamble stake (£M)"
                data-testid="wager-input"
                className="h-8 w-16 bg-pitch-950 text-center font-data text-[13px] text-crt-amber tabular-nums placeholder:text-chrome-muted/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setWager(Math.min(maxWager(bankroll), wager + 1))}
                aria-label="Increase stake"
                className="flex h-8 w-8 items-center justify-center bg-surface-2 text-chrome hover:bg-surface-3"
              >
                <Plus size={13} />
              </button>
            </div>
            {[
              { label: 'None', amt: 0, tid: 'wager-none' },
              { label: '¼', amt: Math.floor(bankroll / 4), tid: 'wager-quarter' },
              { label: 'Max', amt: maxWager(bankroll), tid: 'wager-max' },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => setWager(b.amt)}
                data-testid={b.tid}
                className={[
                  'rounded-full border px-2.5 py-1 text-[11px] transition',
                  (b.label === 'None' ? wager === 0 : wager === b.amt && b.amt > 0)
                    ? 'border-crt-amber/60 bg-crt-amber/20 text-crt-amber'
                    : 'border-white/15 text-chrome-muted hover:bg-white/5',
                ].join(' ')}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buy back a lost life (ladder modes) */}
      {!league && lives < startingLives && (
        <button
          type="button"
          onClick={buyLife}
          disabled={bankroll < lifeBuybackCost(lifeBuybacks)}
          data-testid="buy-life"
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 py-1.5 text-xs font-display text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HeartPulse size={14} /> Buy a life · £{lifeBuybackCost(lifeBuybacks)}M
        </button>
      )}
    </div>
  );
}
