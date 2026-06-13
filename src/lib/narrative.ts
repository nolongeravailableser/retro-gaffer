/**
 * Emergent season narrative — the game recognising drama and FRAMING it. FM has
 * the drama (a title decider, a relegation six-pointer, the final day) but never
 * names it; because we know the table, the matchweek and the stakes, we can.
 *
 * Pure & deterministic, presentation-only: it reads the standings and returns a
 * headline + stakes when a fixture genuinely matters, else null (fall back to the
 * normal verdict). No mechanics, no balance effect.
 */

import { TOP_TIER, PROMOTION_SPOTS, RELEGATION_SPOTS } from './league';

export type StoryTone = 'title' | 'promotion' | 'survival' | 'final';

export interface SeasonStory {
  tone: StoryTone;
  headline: string;
  stakes: string;
}

export interface NarrativeCtx {
  /** Career division tier (1 = top); null for a standalone/draft league. */
  tier: number | null;
  matchweek: number;
  totalWeeks: number;
  clubs: number;
  /** Your position (1-based) and points. */
  yourPos: number;
  yourPoints: number;
  /** Points of the team in 1st. */
  leaderPoints: number;
  /** Points of the team in the last promotion spot. */
  promoCutoffPoints: number;
  /** Points of the highest team currently in the drop zone. */
  dropLinePoints: number;
}

/** Only manufacture drama in the run-in — the last stretch of the season. */
const RUN_IN = 5;

/**
 * Frame the fixture if it carries late-season stakes (title / promotion /
 * survival / final-day), else return null. The checks are "earned": a title
 * story only fires when you're mathematically in the race, etc.
 */
export function seasonNarrative(c: NarrativeCtx): SeasonStory | null {
  const gamesLeft = c.totalWeeks - c.matchweek + 1;
  if (gamesLeft < 1 || gamesLeft > RUN_IN) return null;
  const finalDay = gamesLeft === 1;
  const maxPts = c.yourPoints + gamesLeft * 3;

  const titleStake = c.tier === TOP_TIER || c.tier === null; // top flight or league win
  const promoStake = c.tier !== null && c.tier !== TOP_TIER; // a division below the top
  const relegStake = c.tier !== null; // career relegation matters (standalone has none)
  const gl = `${gamesLeft} game${gamesLeft === 1 ? '' : 's'}`;

  // 1. Title race
  if (titleStake) {
    if (c.yourPos === 1) {
      return finalDay
        ? { tone: 'title', headline: 'Win and the title is yours', stakes: 'One game between you and the trophy.' }
        : { tone: 'title', headline: 'Top of the table', stakes: `${gl} to hold your nerve and lift the title.` };
    }
    if (c.yourPos <= 3 && maxPts >= c.leaderPoints) {
      const gap = c.leaderPoints - c.yourPoints;
      return { tone: 'title', headline: 'In the title race', stakes: `${gap} off top with ${gl} to play — every result counts.` };
    }
  }

  // 2. Promotion race
  if (promoStake) {
    if (c.yourPos <= PROMOTION_SPOTS) {
      return finalDay
        ? { tone: 'promotion', headline: 'Promotion on the line', stakes: 'Hold your place today and you go up.' }
        : { tone: 'promotion', headline: 'In the promotion places', stakes: `${gl} to seal promotion — don't let it slip.` };
    }
    if (maxPts >= c.promoCutoffPoints && c.yourPos <= PROMOTION_SPOTS + 3) {
      const gap = Math.max(0, c.promoCutoffPoints - c.yourPoints);
      return { tone: 'promotion', headline: 'Chasing promotion', stakes: `${gap} off the top ${PROMOTION_SPOTS} with ${gl} left — win or bust.` };
    }
  }

  // 3. Survival
  if (relegStake) {
    const inDrop = c.yourPos > c.clubs - RELEGATION_SPOTS;
    if (inDrop) {
      return finalDay
        ? { tone: 'survival', headline: 'Survival Sunday', stakes: 'Win or you go down — it all comes to this.' }
        : { tone: 'survival', headline: 'Fighting the drop', stakes: `In the relegation zone with ${gl} to save your season.` };
    }
    const buffer = c.yourPoints - c.dropLinePoints;
    if (buffer <= 3 && c.yourPos > c.clubs - RELEGATION_SPOTS - 2) {
      return { tone: 'survival', headline: 'Not safe yet', stakes: `Just ${Math.max(0, buffer)} above the drop — a slip could cost you.` };
    }
  }

  // Final day with no live zone stake — still the season finale.
  if (finalDay) return { tone: 'final', headline: 'Final day', stakes: 'The last game of the season.' };
  return null;
}
