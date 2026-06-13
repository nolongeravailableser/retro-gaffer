import { useGameStore, getPlayer } from '@/store/useGameStore';
import { Wallet, TrendingUp, TrendingDown, Banknote, Receipt } from 'lucide-react';
import type { Player } from '@/lib/types';
import { wageBill, wageBudget, wageTierMult, tierMult } from '@/lib/wages';
import { divisionFinance, seasonSponsorship } from '@/lib/finance';
import { division, seasonScale } from '@/lib/league';
import { matchweekCashflow } from '@/lib/cashflow';
import { stadiumCapacity, attendance } from '@/lib/stadium';

const money = (n: number) => `£${Math.round(n)}M`;

/**
 * FM-style finance view (Club ▸ Finance, career only). Surfaces the money picture
 * that's otherwise scattered: transfer budget, wage bill vs budget, the season's
 * banked sponsorship, the per-matchweek cash flow, and the last match's receipt.
 *
 * Every figure is computed with the SAME lib functions the store applies when it
 * resolves a match (tier mult, season-length scale, facility upkeep, fines), so
 * what you read here is what actually hits the bank. Presentation only.
 */
export default function FinancePanel() {
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const bankroll = useGameStore((s) => s.bankroll);
  const owned = useGameStore((s) => s.owned);
  const streak = useGameStore((s) => s.streak);
  const lastIncome = useGameStore((s) => s.lastIncome);

  if (!career) {
    return (
      <p className="rounded-xl border border-white/10 bg-surface-1 px-4 py-6 text-center text-sm text-chrome-muted">
        The finance office opens once you're managing a club.
      </p>
    );
  }

  const tier = career.tier;
  const divName = division(tier).name;
  const dm = tierMult(tier); // prize / income scaler
  const wageMult = wageTierMult(tier);
  const scale = league ? seasonScale(league) : 1; // per-matchweek season-length normalizer

  const players = owned.map(getPlayer).filter((p): p is Player => !!p);
  const wageRaw = wageBill(players);
  const wageNow = Math.round(wageRaw * wageMult); // headline wage bill (matches the market)
  const budget = wageBudget(bankroll, dm);
  const overBudget = wageNow > budget;

  const fin = divisionFinance(tier);
  const sponsorship = seasonSponsorship(tier);

  const stadium = career.facilities.stadium;

  // Per-matchweek cash flow — exactly as the store scales it on resolve.
  const cf = matchweekCashflow({ tier, facilities: career.facilities, bankroll, streak, scale, wageRaw });
  const { winReward, drawReward, gate, interest: interestMw, wages: wageMw, upkeep: upkeepMw, netWin, netDraw, netLoss } = cf;

  const cap = stadiumCapacity(stadium);
  const att = attendance(stadium, streak);

  return (
    <div className="flex flex-col gap-4" data-testid="finance-panel">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Finances</h2>
        <span className="font-data text-[11px] text-chrome-muted">{divName} · Season {career.season}</span>
      </div>

      {/* Snapshot — the three numbers a manager checks first */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-crt-amber/30 bg-crt-amber/[0.06] px-3 py-2.5">
          <p className="flex items-center gap-1 font-data text-[9px] uppercase tracking-wider text-chrome-muted/70">
            <Wallet size={11} /> Transfer budget
          </p>
          <p className="font-data text-xl text-crt-amber">{money(bankroll)}</p>
          <p className="text-[10px] text-chrome-muted">your bank — spend it in the market</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface-1 px-3 py-2.5">
          <p className="font-data text-[9px] uppercase tracking-wider text-chrome-muted/70">Wage bill / budget</p>
          <p className="font-data text-xl">
            <span className={overBudget ? 'text-rose-300' : 'text-chrome'}>{money(wageNow)}</span>
            <span className="text-[12px] text-chrome-muted"> / {money(budget)}</span>
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${overBudget ? 'bg-tier-poor' : 'bg-tier-elite'}`}
              style={{ width: `${Math.min(100, Math.round((wageNow / Math.max(budget, 1)) * 100))}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-chrome-muted">{overBudget ? 'over budget — trim wages' : 'within budget'}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface-1 px-3 py-2.5">
          <p className="flex items-center gap-1 font-data text-[9px] uppercase tracking-wider text-chrome-muted/70">
            <Banknote size={11} /> Sponsorship / season
          </p>
          <p className="font-data text-xl text-crt-green">{money(sponsorship)}</p>
          <p className="text-[10px] text-chrome-muted">
            banked at kickoff{fin.sponsorGlobal > 0 ? ` · incl. ${money(fin.sponsorGlobal)} TV` : ''}
          </p>
        </div>
      </div>

      {/* Per-matchweek cash flow */}
      <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
        <h3 className="mb-3 font-display text-sm uppercase tracking-wide text-chrome">Per matchweek</h3>
        <div className="flex flex-col gap-1.5 font-data text-[13px]">
          <Row icon={<TrendingUp size={13} className="text-crt-green" />} label="Win bonus" value={`+${money(winReward)}`} good
            note={`draw +${money(drawReward)}`} />
          <Row icon={<TrendingUp size={13} className="text-crt-green" />} label="Gate & central income" value={`+${money(gate)}`} good
            note={`${att.toLocaleString()} of ${cap.toLocaleString()} seats filled`} />
          <Row icon={<TrendingUp size={13} className="text-crt-green" />} label="Interest on the bank" value={`+${money(interestMw)}`} good />
          <div className="my-1 border-t border-white/10" />
          <Row icon={<TrendingDown size={13} className="text-rose-300" />} label="Wages" value={`−${money(wageMw)}`} />
          <Row icon={<TrendingDown size={13} className="text-rose-300" />} label="Facility upkeep" value={`−${money(upkeepMw)}`} />
          <Row icon={<TrendingDown size={13} className="text-rose-300" />} label="Disciplinary fines" value={`~£${fin.finePerCard.toFixed(1)}M/card`}
            note="only if you pick up bookings" muted />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <NetCell label="Win" value={netWin} />
          <NetCell label="Draw" value={netDraw} />
          <NetCell label="Loss" value={netLoss} />
        </div>
        <p className="mt-2 text-[10px] text-chrome-muted">
          Typical net per game (before fines &amp; any Gaffer's Gamble). A winning run fills the ground, lifting gate income.
        </p>
      </div>

      {/* Last match receipt — the actual numbers from your most recent game */}
      {lastIncome && (
        <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 font-display text-sm uppercase tracking-wide text-chrome">
            <Receipt size={14} /> Last match
          </h3>
          <div className="flex flex-col gap-1 font-data text-[13px]">
            <Row label="Result reward" value={`+${money(lastIncome.reward)}`} good />
            <Row label="Gate & income" value={`+${money(lastIncome.income)}`} good />
            <Row label="Interest" value={`+${money(lastIncome.interest)}`} good />
            {lastIncome.streak > 0 && <Row label="Win-streak bonus" value={`+${money(lastIncome.streak)}`} good />}
            <Row label="Wages" value={`−${money(lastIncome.wage)}`} />
            {lastIncome.upkeep > 0 && <Row label="Upkeep" value={`−${money(lastIncome.upkeep)}`} />}
            {!!lastIncome.fine && lastIncome.fine > 0 && <Row label="Fines" value={`−${money(lastIncome.fine)}`} />}
            {lastIncome.wager !== 0 && (
              <Row label="Gaffer's Gamble" value={`${lastIncome.wager > 0 ? '+' : '−'}${money(Math.abs(lastIncome.wager))}`} good={lastIncome.wager > 0} />
            )}
            <div className="my-1 border-t border-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-chrome">Net</span>
              {(() => {
                const net = lastIncome.reward + lastIncome.income + lastIncome.interest + lastIncome.streak
                  - lastIncome.wage - lastIncome.upkeep - (lastIncome.fine ?? 0) + lastIncome.wager;
                return <span className={net >= 0 ? 'text-crt-green' : 'text-rose-300'}>{net >= 0 ? '+' : '−'}{money(Math.abs(net))}</span>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value, note, good, muted }: {
  icon?: React.ReactNode; label: string; value: string; note?: string; good?: boolean; muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`flex min-w-0 items-center gap-1.5 ${muted ? 'text-chrome-muted' : 'text-chrome-muted'}`}>
        {icon}
        <span className="truncate">{label}</span>
        {note && <span className="hidden text-[11px] text-chrome-muted/60 sm:inline">· {note}</span>}
      </span>
      <span className={good ? 'shrink-0 text-crt-green' : muted ? 'shrink-0 text-chrome-muted' : 'shrink-0 text-rose-300'}>{value}</span>
    </div>
  );
}

function NetCell({ label, value }: { label: string; value: number }) {
  const good = value >= 0;
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${good ? 'border-crt-green/30 bg-crt-green/5' : 'border-rose-400/30 bg-rose-500/5'}`}>
      <p className="text-[10px] uppercase tracking-wide text-chrome-muted">{label}</p>
      <p className={`font-data text-sm ${good ? 'text-crt-green' : 'text-rose-300'}`}>{good ? '+' : '−'}{money(Math.abs(value))}</p>
    </div>
  );
}
