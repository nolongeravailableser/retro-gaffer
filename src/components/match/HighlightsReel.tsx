import { useEffect, useMemo, useState } from 'react';
import { Film, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import MatchPitchView from './MatchPitchView';
import { goalScenes, type VizTimeline } from '@/lib/matchviz';
import type { Kit } from '@/lib/kits';

/** Goal build-up animation duration (ms) and how long each goal holds before
 *  the reel advances (a beat on the finish before the next one). */
const PLAY_MS = 1600;
const ADVANCE_MS = 2500;

interface HighlightsReelProps {
  timeline: VizTimeline;
  kitA: Kit;
  kitB: Kit;
  teamAName: string;
  teamBName: string;
}

/**
 * Full-time goals reel. Re-drives the SAME `MatchPitchView` canvas (no duplicate
 * drawing) over a goals-only mini-timeline — each goal's build-up choreography
 * replays in turn, looping, with manual prev/next + play/pause. Skips itself on
 * a 0-0 (the ShotMap still covers chances). Reduced-motion: starts paused, step
 * manually (MatchPitchView already renders a static end-frame under that pref).
 */
export default function HighlightsReel({ timeline, kitA, kitB, teamAName, teamBName }: HighlightsReelProps) {
  // Goals only, in match order — reuse the squads' anchors so shapes are real.
  const reel = useMemo<VizTimeline>(
    () => ({
      scenes: goalScenes(timeline.scenes),
      anchorsA: timeline.anchorsA,
      anchorsB: timeline.anchorsB,
    }),
    [timeline]
  );
  const count = reel.scenes.length;

  const reduced =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [shown, setShown] = useState(1); // 1-based cursor into reel.scenes
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => {
    if (!playing || count === 0) return;
    const id = setInterval(() => setShown((s) => (s % count) + 1), ADVANCE_MS);
    return () => clearInterval(id);
  }, [playing, count]);

  if (count === 0) return null;

  const scene = reel.scenes[shown - 1];
  const scorer = scene?.flash?.text?.replace(/^GOAL!\s*/, '').trim() ?? '';
  const teamName = scene?.side === 'A' ? teamAName : teamBName;

  const step = (d: number) => {
    setPlaying(false);
    setShown((s) => ((s - 1 + d + count) % count) + 1);
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-pitch-900/70 p-3" data-testid="highlights-reel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-sm uppercase tracking-wide text-chrome">
          <Film size={14} /> Highlights
        </h3>
        <span className="font-data text-[11px] text-chrome-muted">
          Goal {shown}/{count}
        </span>
      </div>

      <MatchPitchView
        timeline={reel}
        shown={shown}
        speedDelay={PLAY_MS}
        finished={false}
        kitA={kitA}
        kitB={kitB}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-chrome-muted">
          {scorer ? (
            <>
              <span className="font-display text-crt-green">⚽ {scorer}</span>
              <span className="text-chrome-muted"> · {teamName}</span>
            </>
          ) : (
            teamName
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous goal"
            disabled={count < 2}
            className="rounded-md border border-white/15 p-1 text-chrome-muted transition hover:bg-white/5 hover:text-chrome disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            data-testid="reel-playpause"
            aria-label={playing ? 'Pause' : 'Play'}
            className="rounded-md border border-crt-green/40 bg-crt-green/10 p-1 text-crt-green transition hover:bg-crt-green/20"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next goal"
            disabled={count < 2}
            className="rounded-md border border-white/15 p-1 text-chrome-muted transition hover:bg-white/5 hover:text-chrome disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
