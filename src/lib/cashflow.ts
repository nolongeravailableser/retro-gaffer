/**
 * Per-matchweek cash flow for a career club. Pure, so the Finance page can show
 * exactly what a game nets — and a unit test can pin the numbers.
 *
 * IMPORTANT: this mirrors the economy the store applies in `resolveLeagueRound`
 * (tier mult × season-length scale, gate = base income + matchday, wages, facility
 * upkeep). If the store's resolve math changes, update this in lockstep — the test
 * locks the current constants so accidental drift is caught.
 */

import { tierMult, wageTierMult } from './wages';
import { MATCH_REWARD } from './economy';
import { ROUND_INCOME, interest } from './ladder';
import { facilityUpkeep, matchdayIncomeFor } from './stadium';
import type { Facilities } from './stadium';

export interface MatchweekCashflow {
  /** Income lines. */
  winReward: number;
  drawReward: number;
  gate: number;
  interest: number;
  /** Cost lines. */
  wages: number;
  upkeep: number;
  /** Typical net per result (before fines / any wager). */
  netWin: number;
  netDraw: number;
  netLoss: number;
}

export interface CashflowInput {
  tier: number;
  facilities: Facilities;
  bankroll: number;
  /** Current win streak (drives matchday attendance/income). */
  streak: number;
  /** Season-length normalizer (`seasonScale(league)`); 1 if no league. */
  scale: number;
  /** Raw squad wage bill (`wageBill(players)`), before the tier multiplier. */
  wageRaw: number;
}

export function matchweekCashflow(o: CashflowInput): MatchweekCashflow {
  const dm = tierMult(o.tier);
  const matchday = matchdayIncomeFor(o.facilities.stadium, o.streak);

  const winReward = Math.round(MATCH_REWARD.win * dm * o.scale);
  const drawReward = Math.round(MATCH_REWARD.draw * dm * o.scale);
  const gate = Math.round((ROUND_INCOME * dm + matchday) * o.scale);
  const interestMw = Math.round(interest(o.bankroll) * o.scale);
  const wages = Math.round(o.wageRaw * wageTierMult(o.tier) * o.scale);
  const upkeep = Math.round(facilityUpkeep(o.facilities, dm) * o.scale);

  const costs = wages + upkeep;
  return {
    winReward, drawReward, gate, interest: interestMw, wages, upkeep,
    netWin: winReward + gate + interestMw - costs,
    netDraw: drawReward + gate + interestMw - costs,
    netLoss: gate + interestMw - costs,
  };
}
