/**
 * "Why you lost" — plain-English post-match causation, derived purely from the
 * deterministic engine's own output. FM (and most football games) give you a
 * pile of stats but never the WHY; because our engine is fully deterministic we
 * can read its actual levers back and explain the result truthfully:
 *
 *   - xG (result.xg)      → who created the better chances (the strategic story)
 *   - score vs xG         → finishing & goalkeeping (conversion either end)
 *   - team stat profiles  → which dimension caused the chance gap (name it)
 *   - red cards (events)   → a man-down swing
 *
 * Pure & deterministic: same inputs → same verdict. No RNG, no engine coupling
 * beyond reading the already-computed result + the squads' stat profiles.
 */

import { teamStatProfile } from './stats';
import type { MatchResult, Player } from './types';

export interface AnalysisFactor {
  text: string;
  /** From YOUR (side A) perspective: green = in your favour, rose = against. */
  tone: 'good' | 'bad' | 'neutral';
}

export interface MatchAnalysis {
  /** One-line verdict (the "why"). */
  headline: string;
  /** 1–4 supporting factors, most salient first. */
  factors: AnalysisFactor[];
}

interface AnalysisTeam {
  name: string;
  squad: Player[];
}

/** A meaningful chance-creation gap (in xG). Below this, chances were "even". */
const XG_EDGE = 0.6;
/** A meaningful goals-vs-xG gap (finishing or goalkeeping told a story). */
const CONV_EDGE = 0.9;

const xg1 = (n: number) => n.toFixed(1);

/**
 * Read a finished match back into a plain-English verdict from side A's
 * perspective (`result.outcome` is already side-A relative).
 */
export function analyzeMatch(
  result: MatchResult,
  teamA: AnalysisTeam,
  teamB: AnalysisTeam
): MatchAnalysis {
  const profA = teamStatProfile(teamA.squad);
  const profB = teamStatProfile(teamB.squad);
  const xgA = result.xg.a;
  const xgB = result.xg.b;
  const gA = result.score.a;
  const gB = result.score.b;

  const redsA = result.events.filter((e) => e.side === 'A' && e.kind === 'red').length;
  const redsB = result.events.filter((e) => e.side === 'B' && e.kind === 'red').length;

  const createdMore = xgA - xgB >= XG_EDGE;
  const createdFewer = xgB - xgA >= XG_EDGE;

  const wasteful = gA - xgA <= -CONV_EDGE; // scored fewer than chances merited
  const clinical = gA - xgA >= CONV_EDGE; // took chances ruthlessly
  const leaky = gB - xgB >= CONV_EDGE; // conceded more than they earned
  const resolute = gB - xgB <= -CONV_EDGE; // held them below their xG

  // ── Headline: outcome × who-created-more ──────────────────────────────────
  let headline: string;
  if (result.outcome === 'win') {
    headline = createdMore
      ? 'Deserved win — you controlled the chances.'
      : createdFewer
        ? 'Smash and grab — you won despite being out-created.'
        : 'Edged it — a tight one settled your way.';
  } else if (result.outcome === 'loss') {
    headline = createdFewer
      ? 'Outplayed — they made the better chances.'
      : createdMore
        ? "Wasteful — you created enough to win but didn't take it."
        : 'Fine margins — a tight game that went their way.';
  } else {
    headline = createdMore
      ? "Frustrating draw — you made the chances but couldn't break through."
      : createdFewer
        ? 'A point earned — you rode your luck for the draw.'
        : 'Honours even — nothing between the sides.';
  }

  // ── Factors, most salient first ───────────────────────────────────────────
  const factors: AnalysisFactor[] = [];

  // 1. The chance balance (always — it's the headline's evidence).
  factors.push({
    text: createdMore
      ? `You created the better chances — xG ${xg1(xgA)} to ${xg1(xgB)}.`
      : createdFewer
        ? `They created the better chances — xG ${xg1(xgB)} to ${xg1(xgA)}.`
        : `Chances were even — xG ${xg1(xgA)} to ${xg1(xgB)}.`,
    tone: createdMore ? 'good' : createdFewer ? 'bad' : 'neutral',
  });

  // 2. Name the dimension behind the chance gap (the causal line FM never gives).
  if (createdFewer) {
    factors.push({
      text: `Their attacking play (${Math.round(profB.creation)}) pulled your defence (${Math.round(profA.defending)}) out of shape.`,
      tone: 'bad',
    });
  } else if (createdMore) {
    factors.push({
      text: `Your attacking play (${Math.round(profA.creation)}) opened up their defence (${Math.round(profB.defending)}).`,
      tone: 'good',
    });
  }

  // 3. Conversion at the sharper end (finishing OR goalkeeping — whichever spoke loudest).
  const yourGap = gA - xgA; // +ve = clinical, -ve = wasteful
  const theirGap = gB - xgB; // +ve = you were leaky, -ve = you were resolute
  if (Math.abs(yourGap) >= Math.abs(theirGap)) {
    if (wasteful) factors.push({ text: `Wasteful in front of goal — ${gA} scored from ${xg1(xgA)} xG.`, tone: 'bad' });
    else if (clinical) factors.push({ text: `Clinical finishing — ${gA} from just ${xg1(xgA)} xG.`, tone: 'good' });
    else if (leaky) factors.push({ text: `Soft at the back — ${gB} conceded from ${xg1(xgB)} xG.`, tone: 'bad' });
    else if (resolute) factors.push({ text: `Resolute defending — held them to ${gB} from ${xg1(xgB)} xG.`, tone: 'good' });
  } else {
    if (leaky) factors.push({ text: `Soft at the back — ${gB} conceded from ${xg1(xgB)} xG.`, tone: 'bad' });
    else if (resolute) factors.push({ text: `Resolute defending — held them to ${gB} from ${xg1(xgB)} xG.`, tone: 'good' });
    else if (wasteful) factors.push({ text: `Wasteful in front of goal — ${gA} scored from ${xg1(xgA)} xG.`, tone: 'bad' });
    else if (clinical) factors.push({ text: `Clinical finishing — ${gA} from just ${xg1(xgA)} xG.`, tone: 'good' });
  }

  // 4. A man down either way — a real momentum swing worth calling out.
  if (redsA > 0) {
    factors.push({ text: `Down to ${11 - redsA} men after a red card — it told.`, tone: 'bad' });
  } else if (redsB > 0) {
    factors.push({ text: `Their red card swung the momentum your way.`, tone: 'good' });
  }

  return { headline, factors: factors.slice(0, 4) };
}
