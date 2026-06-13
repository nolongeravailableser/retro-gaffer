/**
 * "Where it was won" — a shot map + channel read derived from the same
 * deterministic viz timeline the 2D pitch already plays. Each goal/chance scene
 * ends with the ball at the shot location, so we can plot every attempt and
 * report which channel each side's threat came through. Pure: scenes in → map
 * out, no RNG (the scenes were already seeded by buildVizTimeline).
 *
 * Pairs with the post-match verdict (matchAnalysis): the verdict says WHY, this
 * says WHERE.
 */

import type { VizScene } from './matchviz';

export type Channel = 'left' | 'central' | 'right';

export interface Shot {
  /** 'A' = you, 'B' = the opponent. */
  side: 'A' | 'B';
  /** Pitch coords, 0–1 (A attacks toward x=1, B toward x=0). */
  x: number;
  y: number;
  goal: boolean;
}

export interface SideShots {
  goals: number;
  chances: number;
  /** The channel most of this side's attempts came through (null if none). */
  channel: Channel | null;
}

export interface ShotMapData {
  shots: Shot[];
  yours: SideShots;
  theirs: SideShots;
}

/** Vertical thirds of the pitch (y: 0 top). */
function channelOf(y: number): Channel {
  if (y < 0.38) return 'left';
  if (y > 0.62) return 'right';
  return 'central';
}

function summarise(shots: Shot[]): SideShots {
  const counts: Record<Channel, number> = { left: 0, central: 0, right: 0 };
  let goals = 0;
  for (const s of shots) {
    counts[channelOf(s.y)]++;
    if (s.goal) goals++;
  }
  let channel: Channel | null = null;
  if (shots.length > 0) {
    channel = (Object.keys(counts) as Channel[]).reduce((a, b) => (counts[b] > counts[a] ? b : a), 'left');
  }
  return { goals, chances: shots.length - goals, channel };
}

/** Build the shot map from a finished match's viz scenes. */
export function buildShotMap(scenes: readonly VizScene[]): ShotMapData {
  const shots: Shot[] = [];
  for (const sc of scenes) {
    if (sc.kind !== 'goal' && sc.kind !== 'chance') continue;
    const end = sc.ball[sc.ball.length - 1];
    if (!end) continue;
    shots.push({ side: sc.side, x: end.x, y: end.y, goal: sc.kind === 'goal' });
  }
  return {
    shots,
    yours: summarise(shots.filter((s) => s.side === 'A')),
    theirs: summarise(shots.filter((s) => s.side === 'B')),
  };
}

/** Plain-English phrasing for a dominant channel ("through the middle" etc.). */
export function channelPhrase(c: Channel | null): string {
  if (c === 'central') return 'through the middle';
  if (c === 'left') return 'down the left';
  if (c === 'right') return 'down the right';
  return '';
}
