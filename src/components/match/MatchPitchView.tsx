import { useEffect, useRef } from 'react';
import { ballAt, type VizTimeline } from '@/lib/matchviz';
import { gkColor, type Kit } from '@/lib/kits';

interface MatchPitchViewProps {
  timeline: VizTimeline;
  /** How many engine events have been shown (the MatchView playback cursor). */
  shown: number;
  /** Milliseconds per event at the current speed. */
  speedDelay: number;
  finished: boolean;
  /** What each side wears (clash-resolved by the caller via resolveKits). */
  kitA: Kit;
  kitB: Kit;
}

const PITCH_DARK = '#0a1f12';
const PITCH_LIGHT = '#0f2e1b';
const LINE = 'rgba(255,255,255,0.16)';

/** Paint one player dot in his kit: shirt colour + pattern, readable at ~r px. */
function drawKitDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  kit: Kit
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = kit.primary;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = kit.secondary;
  switch (kit.pattern) {
    case 'stripes':
      ctx.fillRect(cx - r * 0.65, cy - r, r * 0.36, 2 * r);
      ctx.fillRect(cx + r * 0.29, cy - r, r * 0.36, 2 * r);
      break;
    case 'hoops':
      ctx.fillRect(cx - r, cy - r * 0.65, 2 * r, r * 0.36);
      ctx.fillRect(cx - r, cy + r * 0.29, 2 * r, r * 0.36);
      break;
    case 'sash':
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-r * 1.5, -r * 0.2, r * 3, r * 0.4);
      break;
    case 'halves':
      ctx.fillRect(cx, cy - r, r, 2 * r);
      break;
    case 'solid':
      break;
  }
  ctx.restore();
  // A dark ring separates every dot from the pitch and from teammates.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * The 2D match view: one canvas, one rAF loop, ~23 dots + a ball lerping
 * between the choreographer's keyframes. Pure presentation — it samples the
 * SAME (events, shown, speed) playback state as the ticker, so the two can
 * never drift apart. Honors prefers-reduced-motion (slow static redraws).
 */
export default function MatchPitchView({ timeline, shown, speedDelay, finished, kitA, kitB }: MatchPitchViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef({ shown: -1, at: 0 });
  // Persistent rendered positions per side, lerped toward each frame's target so
  // formation shifts and the carrier hand-off glide instead of snapping at scene
  // boundaries. Lazily sized to the squads; survives across frames.
  const smoothRef = useRef<{ A: { x: number; y: number }[]; B: { x: number; y: number }[] }>({ A: [], B: [] });
  const propsRef = useRef({ timeline, shown, speedDelay, finished, kitA, kitB });
  propsRef.current = { timeline, shown, speedDelay, finished, kitA, kitB };
  // Restart the scene clock whenever the playback cursor advances.
  if (clockRef.current.shown !== shown) {
    clockRef.current = { shown, at: typeof performance !== 'undefined' ? performance.now() : 0 };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { timeline: tl, shown: cur, speedDelay: delay, finished: done, kitA: ka, kitB: kb } = propsRef.current;
      const scenes = tl.scenes;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!scenes.length || w === 0) return;

      const now = performance.now();
      const idx = done
        ? scenes.length - 1
        : Math.max(0, Math.min(scenes.length - 1, cur - 1));
      const scene = scenes[idx];
      const t = done || reduced ? 1 : Math.min(1, (now - clockRef.current.at) / delay);

      // ── pitch ──
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, PITCH_LIGHT);
      grad.addColorStop(1, PITCH_DARK);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // mow stripes
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      const stripes = 7;
      for (let i = 0; i < stripes; i += 2) {
        ctx.fillRect((w / stripes) * i, 0, w / stripes, h);
      }

      const mx = w * 0.035;
      const my = h * 0.06;
      const px = (x: number) => mx + x * (w - 2 * mx);
      const py = (y: number) => my + y * (h - 2 * my);

      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(px(0), py(0), px(1) - px(0), py(1) - py(0));
      // halfway + centre circle
      ctx.beginPath();
      ctx.moveTo(px(0.5), py(0));
      ctx.lineTo(px(0.5), py(1));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px(0.5), py(0.5), (w - 2 * mx) * 0.085, 0, Math.PI * 2);
      ctx.stroke();
      // boxes
      const boxH = py(0.78) - py(0.22);
      ctx.strokeRect(px(0), py(0.22), px(0.13) - px(0), boxH);
      ctx.strokeRect(px(0.87), py(0.22), px(1) - px(0.87), boxH);

      // Dribble vs pass: a long ball journey (a pass) snaps out fast then
      // settles (ease-out); a short one (the carrier dribbling at his feet)
      // stays gentle and near-linear. Player shapes still use the raw `t`.
      const first = scene.ball[0];
      const last = scene.ball[scene.ball.length - 1];
      const travel = Math.hypot(last.x - first.x, last.y - first.y);
      const isPass = travel > 0.2;
      const bt = done || reduced ? 1 : isPass ? 1 - (1 - t) * (1 - t) : t;
      // Current ball position — players shape themselves around it.
      const b = ballAt(scene, bt);

      // ── players, in their kits ──
      const r = Math.max(3.5, w * 0.013);
      const drift = reduced ? 0 : 0.006;
      // Who's on the ball drives the shape. Live-ball scenes only: cards,
      // injuries and whistles are dead-ball (ball start == end) so the teams
      // just hold their shape. scene.side is the team in possession.
      const liveBall =
        scene.ball[0].x !== scene.ball[scene.ball.length - 1].x ||
        scene.ball[0].y !== scene.ball[scene.ball.length - 1].y;
      const possSide: 'A' | 'B' | null = liveBall ? scene.side : null;
      // How far up the pitch each line pushes (keepers stay home).
      const ROLE_ADV: Record<string, number> = { GK: 0, DEF: 1, MID: 1.6, FWD: 2.1 };

      const drawSide = (anchors: typeof tl.anchorsA, kit: Kit, side: 'A' | 'B') => {
        const dir = side === 'A' ? 1 : -1; // attacking direction
        const attacking = possSide === side;
        const defending = possSide !== null && possSide !== side;
        const keeper = gkColor(kit);

        // Transform each anchor: possession shape (push up / drop) + a tilt
        // toward the ball's lane (compactness) + off-ball runs + organic drift.
        const target = anchors.map((a, i) => {
          const adv = ROLE_ADV[a.role] ?? 1;
          let x = a.x;
          if (attacking) x += dir * 0.034 * adv;
          else if (defending) x -= dir * 0.02 * adv;
          // Off-ball runs: when attacking, the forward line surges and recycles
          // (bigger amplitude up front) so it reads as players making runs.
          if (attacking && a.role !== 'GK') {
            const runAmp = a.role === 'FWD' ? 0.03 : a.role === 'MID' ? 0.017 : 0.005;
            x += dir * runAmp * (0.5 + 0.5 * Math.sin(now * 0.0016 + i * 1.3));
          }
          const tilt = a.role === 'GK' ? 0.05 : 0.16;
          let y = a.y + (b.y - a.y) * tilt;
          x += drift * Math.sin(now * 0.0013 + i * 2.1);
          y += drift * 1.4 * Math.cos(now * 0.0009 + i * 1.7);
          return { x, y };
        });

        // The outfield player nearest the ball carries it (attacking side, glued
        // to the ball so it sits at his feet) or closes it down (defending side).
        // As the ball travels its path the nearest dot changes → it reads as a
        // pass moving between players.
        let near = -1;
        let nd = Infinity;
        for (let i = 0; i < target.length; i++) {
          if (anchors[i].role === 'GK') continue;
          const dx = target[i].x - b.x;
          const dy = target[i].y - b.y;
          const d = dx * dx + dy * dy;
          if (d < nd) { nd = d; near = i; }
        }
        if (near >= 0) {
          if (attacking) {
            target[near].x = b.x;
            target[near].y = b.y;
          } else if (defending) {
            target[near].x += (b.x - target[near].x) * 0.72;
            target[near].y += (b.y - target[near].y) * 0.72;
          }
        }

        // Glide toward the target: a per-frame follow so scene boundaries and
        // the carrier hand-off ease instead of snapping. The carrier tracks the
        // ball harder so it stays at his feet. Reduced motion snaps.
        const store = smoothRef.current[side];
        if (store.length !== target.length) {
          store.length = 0;
          for (const tpos of target) store.push({ x: tpos.x, y: tpos.y });
        }
        target.forEach((tp, i) => {
          const k = reduced ? 1 : i === near ? 0.45 : 0.2;
          store[i].x += (tp.x - store[i].x) * k;
          store[i].y += (tp.y - store[i].y) * k;
        });

        store.forEach((p, i) => {
          const x = px(Math.max(0.02, Math.min(0.98, p.x)));
          const y = py(Math.max(0.04, Math.min(0.96, p.y)));
          if (anchors[i].role === 'GK') {
            // Keepers wear their own shirt, as in real football.
            drawKitDot(ctx, x, y, r * 0.9, { primary: keeper, secondary: keeper, pattern: 'solid' });
          } else {
            drawKitDot(ctx, x, y, r, kit);
          }
        });
      };
      drawSide(tl.anchorsA, ka, 'A');
      drawSide(tl.anchorsB, kb, 'B');

      // ── ball (drawn on top of its carrier) ──
      ctx.beginPath();
      ctx.arc(px(b.x), py(b.y), Math.max(2.5, r * 0.55), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.7)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // ── flash banner ──
      const flashOn = scene.flash && (scene.kind === 'flavour' || t > 0.62);
      if (scene.flash && flashOn) {
        const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(now * 0.012);
        ctx.font = `bold ${Math.max(15, Math.round(w * 0.045))}px Oswald, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = scene.flash.color;
        ctx.globalAlpha = Math.min(1, pulse);
        ctx.shadowColor = scene.flash.color;
        ctx.shadowBlur = 14;
        ctx.fillText(scene.flash.text, w / 2, py(0.12));
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    };

    if (reduced) {
      draw();
      const id = setInterval(draw, 400);
      return () => {
        clearInterval(id);
        window.removeEventListener('resize', resize);
      };
    }
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-white/10"
      style={{ aspectRatio: '16 / 10', maxHeight: '38vh' }}
    >
      <canvas ref={canvasRef} className="h-full w-full" data-testid="match-pitch" />
    </div>
  );
}
