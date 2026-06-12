import { Play, ShoppingCart, Users, ChevronRight, Wand2, Check } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { XI_SIZE } from '@/lib/types';
import { careerCupDue } from '@/lib/cup';
import type { Journey, JourneyStage } from '@/lib/journey';

interface JourneyBarProps {
  journey: Journey;
  filled: number;
  round: number;
  /** Whether the player is currently looking at the stage's target tab. */
  onTargetTab: boolean;
  /** Career season number (labels round 1 "Start Season N"), or null. */
  careerSeason: number | null;
  /** Primary action: route to the stage's tab, or kick off when ready there. */
  onGo: () => void;
}

const STEPS: { stage: JourneyStage; label: string }[] = [
  { stage: 'sign', label: 'Sign' },
  { stage: 'pick', label: 'Pick XI' },
  { stage: 'play', label: 'Kick Off' },
];

/**
 * The core-loop guide: a 3-step indicator (Sign → Pick XI → Kick Off) over one
 * stage-aware primary action, with the matching one-tap helper (Auto-Sign /
 * Auto-Pick) inline. Replaces guesswork about "where do I go next?".
 */
export default function JourneyBar({
  journey,
  filled,
  round,
  onTargetTab,
  careerSeason,
  onGo,
}: JourneyBarProps) {
  const autoBuy = useGameStore((s) => s.autoBuy);
  const autoFillSquad = useGameStore((s) => s.autoFillSquad);
  const autoPickXI = useGameStore((s) => s.autoPickXI);
  // Career/League sign from the browsable market — the one-tap helper fills the
  // XI with free agents; Classic & co. auto-buy from the draft shop offers.
  const isMarket = useGameStore((s) => s.career !== null || s.league !== null);
  // In a Career, the next match is a knockout when a cup tie is due this matchweek.
  const cupTieDue = useGameStore(
    (s) => !!s.cup && !!s.league && !!s.career && careerCupDue(s.cup, s.league.matchweek)
  );

  const { stage } = journey;
  const stageIdx = STEPS.findIndex((s) => s.stage === stage);

  const primaryLabel =
    stage === 'sign'
      ? 'Sign players'
      : stage === 'pick'
        ? `Pick your XI · ${filled}/${XI_SIZE}`
        : cupTieDue
          ? '🏆 Play Cup Tie'
          : careerSeason && round === 1
            ? `Start Season ${careerSeason}`
            : onTargetTab
              ? `Kick off — Play ${isMarket ? 'Matchweek' : 'Round'} ${round}`
              : `Ready! Play ${isMarket ? 'Matchweek' : 'Round'} ${round}`;

  const PrimaryIcon = stage === 'sign' ? ShoppingCart : stage === 'pick' ? Users : Play;

  // The stage's one-tap shortcut. Auto-Sign/Auto-Pick are store actions, so
  // they work from any tab — the helper is always at hand, not buried in a panel.
  const helper =
    stage === 'sign'
      ? isMarket
        ? { label: 'Fill (free)', action: autoFillSquad, title: 'Fill empty XI slots with the best free agents (£0)' }
        : { label: 'Auto-Sign', action: autoBuy, title: 'Sign the best offers that fill your missing roles' }
      : stage === 'pick'
        ? { label: 'Auto-Pick', action: autoPickXI, title: 'Field your strongest available XI' }
        : null;

  return (
    <div className="sticky top-0 sm:top-[3.25rem] z-10 -mx-4 mb-4 bg-pitch-950/85 px-4 pb-2 pt-1.5 backdrop-blur-sm">
      {/* Step indicator — where you are in sign → pick → kick off */}
      <div className="mb-1.5 flex items-center justify-center gap-1.5" aria-label={`Step ${stageIdx + 1} of 3`}>
        {STEPS.map((step, i) => {
          const done = i < stageIdx;
          const current = i === stageIdx;
          return (
            <span key={step.stage} className="flex items-center gap-1.5">
              {i > 0 && <span className={`h-px w-5 sm:w-8 ${done || current ? 'bg-crt-green/50' : 'bg-white/15'}`} />}
              <span
                className={[
                  'flex items-center gap-1 font-display text-[10px] uppercase tracking-wide transition-colors',
                  current ? 'text-crt-green' : done ? 'text-crt-green/60' : 'text-chrome-muted/60',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px]',
                    current
                      ? 'border-crt-green bg-crt-green/20'
                      : done
                        ? 'border-crt-green/50 bg-crt-green/10'
                        : 'border-white/20',
                  ].join(' ')}
                >
                  {done ? <Check size={8} /> : i + 1}
                </span>
                {step.label}
              </span>
            </span>
          );
        })}
      </div>

      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={onGo}
          data-testid="kickoff-cta"
          className={[
            'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-display text-base shadow-glow transition',
            stage === 'play'
              ? 'border-crt-green/60 bg-crt-green/20 text-crt-green hover:bg-crt-green/30'
              : 'border-crt-amber/40 bg-crt-amber/10 text-crt-amber hover:bg-crt-amber/20',
          ].join(' ')}
        >
          <PrimaryIcon size={18} className="shrink-0" />
          <span className="truncate">{primaryLabel}</span>
          {!onTargetTab && <ChevronRight size={18} className="shrink-0 opacity-80" />}
        </button>

        {helper && (
          <button
            type="button"
            onClick={helper.action}
            data-testid="journey-helper"
            title={helper.title}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-crt-green/40 bg-crt-green/10 px-3 font-display text-sm text-crt-green transition hover:bg-crt-green/20"
          >
            <Wand2 size={15} />
            <span className="hidden sm:inline">{helper.label}</span>
          </button>
        )}
      </div>

      {/* Stage detail — what exactly is missing */}
      {stage === 'sign' && journey.missingText && (
        <p className="mt-1 text-center text-[11px] text-chrome-muted">
          Still needed for a legal XI: <span className="text-crt-amber">{journey.missingText}</span>
        </p>
      )}
    </div>
  );
}
