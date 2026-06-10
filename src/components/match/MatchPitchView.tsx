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

      // ── players, in their kits ──
      const r = Math.max(3.5, w * 0.013);
      const drift = reduced ? 0 : 0.007;
      const drawSide = (anchors: typeof tl.anchorsA, kit: Kit, shift: number) => {
        const keeper = gkColor(kit);
        anchors.forEach((a, i) => {
          const x = Math.max(0.02, Math.min(0.98, a.x + shift)) +
            drift * Math.sin(now * 0.0013 + i * 2.1);
          const y = Math.max(0.04, Math.min(0.96, a.y + drift * 1.6 * Math.cos(now * 0.0009 + i * 1.7)));
          if (a.role === 'GK') {
            // Keepers wear their own shirt, as in real football.
            drawKitDot(ctx, px(x), py(y), r * 0.9, { primary: keeper, secondary: keeper, pattern: 'solid' });
          } else {
            drawKitDot(ctx, px(x), py(y), r, kit);
          }
        });
      };
      drawSide(tl.anchorsA, ka, scene.shiftA);
      drawSide(tl.anchorsB, kb, -scene.shiftB);

      // ── ball ──
      const b = ballAt(scene, t);
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
