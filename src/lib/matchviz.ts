/**
 * Match choreographer — turns the engine's EVENT timeline into 2D scenes the
 * pitch view can draw. Pure presentation: it reads a finished MatchResult and
 * synthesizes plausible positioning/ball movement around the fixed beats the
 * engine produced. It NEVER touches engine state or engine RNG — it has its
 * own seeded Rng (`{seed}-viz`), so the same match always replays with the
 * exact same choreography while gameplay outcomes stay untouched.
 *
 * Coordinates are normalized: x 0→1 (side A defends x=0, attacks x=1),
 * y 0→1 (top→bottom). The renderer maps them onto a canvas.
 */

import type { Player, MatchEvent, Role } from './types';
import { Rng } from './rng';

export interface VizPoint {
  /** Local progress within the scene, 0–1. */
  t: number;
  x: number;
  y: number;
}

export interface VizFlash {
  text: string;
  /** Canvas-friendly colour. */
  color: string;
}

/** One scene per engine event — the unit of playback. */
export interface VizScene {
  kind: MatchEvent['kind'];
  side: 'A' | 'B';
  /** Ball path through the scene (ordered by t, first t=0, last t=1). */
  ball: VizPoint[];
  /** Forward (+) / backward (−) territorial shift for each team, 0–1 scale. */
  shiftA: number;
  shiftB: number;
  /** Banner to flash during the scene's payoff (shown from t ≈ 0.7). */
  flash?: VizFlash;
}

export interface VizAnchor {
  x: number;
  y: number;
  role: Role;
  name: string;
}

export interface VizTimeline {
  scenes: VizScene[];
  anchorsA: VizAnchor[];
  anchorsB: VizAnchor[];
}

const FLASH_COLORS = {
  goal: '#39ff14',
  chance: '#e6e8e3',
  yellow: '#ffb000',
  red: '#fb7185',
  injury: '#fdba74',
  flavour: '#9aa39b',
} as const;

/** X of each line for side A (keeper → forwards), neutral shape. */
const LINE_X: Record<Role, number> = { GK: 0.06, DEF: 0.24, MID: 0.46, FWD: 0.66 };
const ROLE_ORDER: Role[] = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * Formation anchors straight from a squad's role make-up (works for any squad:
 * the player's XI, PvP imports, rival spines, partial XIs). Side A faces right;
 * mirror for side B.
 */
export function anchorsFromSquad(squad: readonly Player[], mirror: boolean): VizAnchor[] {
  const out: VizAnchor[] = [];
  for (const role of ROLE_ORDER) {
    const line = squad.filter((p) => p.role === role);
    line.forEach((p, i) => {
      const y = line.length === 1 ? 0.5 : 0.14 + (0.72 * i) / (line.length - 1);
      const x = LINE_X[role];
      out.push({ x: mirror ? 1 - x : x, y, role, name: p.name });
    });
  }
  return out;
}

/** A plausible pass node in the attacking build-up, by depth 0..1 (own → opp). */
function node(rng: Rng, side: 'A' | 'B', depth: number): { x: number; y: number } {
  const x = 0.12 + depth * 0.74 + (rng.next() - 0.5) * 0.08;
  const y = 0.2 + rng.next() * 0.6;
  return { x: side === 'A' ? x : 1 - x, y };
}

/** Goal mouth for the side ATTACKED BY `side`. */
function goalMouth(rng: Rng, side: 'A' | 'B'): { x: number; y: number } {
  const y = 0.42 + rng.next() * 0.16;
  return { x: side === 'A' ? 0.97 : 0.03, y };
}

function buildUp(rng: Rng, side: 'A' | 'B', finish: { x: number; y: number }, flash?: VizFlash): VizScene {
  // Two-pass build-up → the payoff at `finish`.
  const p1 = node(rng, side, 0.35);
  const p2 = node(rng, side, 0.7);
  return {
    kind: 'chance',
    side,
    ball: [
      { t: 0, ...node(rng, side, 0.15) },
      { t: 0.35, ...p1 },
      { t: 0.65, ...p2 },
      { t: 1, ...finish },
    ],
    shiftA: side === 'A' ? 0.08 : -0.05,
    shiftB: side === 'B' ? 0.08 : -0.05,
    flash,
  };
}

/** Neutral possession scene — keeps the pitch breathing between incidents. */
function possession(rng: Rng, side: 'A' | 'B'): VizScene {
  const a = node(rng, side, 0.2 + rng.next() * 0.3);
  const b = node(rng, side, 0.3 + rng.next() * 0.35);
  const c = node(rng, side, 0.25 + rng.next() * 0.4);
  return {
    kind: 'flavour',
    side,
    ball: [
      { t: 0, ...a },
      { t: 0.4, ...b },
      { t: 0.75, ...c },
      { t: 1, ...node(rng, side, 0.35 + rng.next() * 0.3) },
    ],
    shiftA: side === 'A' ? 0.03 : -0.02,
    shiftB: side === 'B' ? 0.03 : -0.02,
  };
}

/** Build the full choreography for a finished match. Pure & deterministic. */
export function buildVizTimeline(
  events: readonly MatchEvent[],
  seed: string | number,
  squadA: readonly Player[],
  squadB: readonly Player[],
  /** xG dominance (A share, 0–1) — weights neutral possession territory. */
  xgShareA = 0.5
): VizTimeline {
  const rng = new Rng(`${seed}-viz`);
  const scenes: VizScene[] = [];

  for (const e of events) {
    const side = e.side;
    switch (e.kind) {
      case 'goal': {
        const scene = buildUp(rng, side, goalMouth(rng, side), {
          text: 'GOAL!',
          color: FLASH_COLORS.goal,
        });
        scenes.push({ ...scene, kind: 'goal' });
        break;
      }
      case 'chance': {
        // Saved or just wide: finish at/near the keeper, not in the net.
        const mouth = goalMouth(rng, side);
        const finish = {
          x: side === 'A' ? mouth.x - 0.045 : mouth.x + 0.045,
          y: mouth.y + (rng.next() - 0.5) * 0.22,
        };
        scenes.push(buildUp(rng, side, finish, { text: 'CHANCE', color: FLASH_COLORS.chance }));
        break;
      }
      case 'yellow':
      case 'red': {
        // A foul BY `side` — the incident happens where the other team had it.
        const other = side === 'A' ? 'B' : 'A';
        const spot = node(rng, other, 0.3 + rng.next() * 0.3);
        scenes.push({
          kind: e.kind,
          side,
          ball: [
            { t: 0, ...spot },
            { t: 1, ...spot },
          ],
          shiftA: 0,
          shiftB: 0,
          flash: {
            text: e.kind === 'red' ? 'RED CARD' : 'YELLOW CARD',
            color: FLASH_COLORS[e.kind],
          },
        });
        break;
      }
      case 'injury': {
        const spot = node(rng, side, 0.25 + rng.next() * 0.4);
        scenes.push({
          kind: 'injury',
          side,
          ball: [
            { t: 0, ...spot },
            { t: 1, ...spot },
          ],
          shiftA: 0,
          shiftB: 0,
          flash: { text: 'INJURY', color: FLASH_COLORS.injury },
        });
        break;
      }
      default: {
        // Flavour beats: kickoff / half-time / full-time reset to the spot;
        // anything else is neutral possession weighted by xG dominance.
        if (e.minute === 0 || e.minute === 45 || e.minute === 90) {
          const isFT = e.minute === 90 && e.text.includes('full-time');
          const isHT = e.minute === 45;
          scenes.push({
            kind: 'flavour',
            side: 'A',
            ball: [
              { t: 0, x: 0.5, y: 0.5 },
              { t: 1, x: 0.5, y: 0.5 },
            ],
            shiftA: 0,
            shiftB: 0,
            flash:
              isFT ? { text: 'FULL-TIME', color: FLASH_COLORS.flavour }
              : isHT ? { text: 'HALF-TIME', color: FLASH_COLORS.flavour }
              : { text: 'KICK-OFF', color: FLASH_COLORS.flavour },
          });
        } else {
          scenes.push(possession(rng, rng.next() < xgShareA ? 'A' : 'B'));
        }
      }
    }
  }

  return {
    scenes,
    anchorsA: anchorsFromSquad(squadA, false),
    anchorsB: anchorsFromSquad(squadB, true),
  };
}

/** Eased lerp between scene ball keyframes at local progress t (0–1). */
export function ballAt(scene: VizScene, t: number): { x: number; y: number } {
  const pts = scene.ball;
  if (t <= pts[0].t) return { x: pts[0].x, y: pts[0].y };
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const a = pts[i - 1];
      const b = pts[i];
      const span = b.t - a.t || 1;
      const u = (t - a.t) / span;
      const e = u * u * (3 - 2 * u); // smoothstep
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}
