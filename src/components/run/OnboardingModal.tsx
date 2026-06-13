import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Sparkles, ShoppingCart, Users, TrendingUp, Briefcase,
  ArrowRight, ArrowLeft, Dice5, Play,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { DEFAULT_KIT, type Kit } from '@/lib/kits';
import KitPicker from './KitPicker';

interface OnboardingModalProps {
  /** Opened just to replay the tutorial (player already onboarded). */
  tutorialOnly: boolean;
  /** Close the modal (first-run also persists via completeOnboarding). */
  onClose: () => void;
}

const CLUB_NAMES = [
  'Athletic Nostalgia', 'Real Retro', 'Pixel Rovers', 'Dynamo Dial-Up',
  'Sporting Cathode', 'Inter Arcade', 'CRT United', 'AFC Anorak',
  'Wanderers FC', 'Phosphor Town',
];
const MANAGER_NAMES = [
  'The Gaffer', 'El Míster', 'Big Sam', 'Il Mister', 'Der Boss',
  'Cloughie', 'The Special One', 'Le Professeur',
];

interface Card {
  icon: typeof Trophy;
  title: string;
  body: string;
}

const CARDS: Card[] = [
  {
    icon: Trophy,
    title: 'Two ways to play',
    body: 'Career is the deep one: take a club from the bottom of the English pyramid and build a dynasty over many seasons. Classic is a quick 12-round climb in one sitting. Pick either from the start menu.',
  },
  {
    icon: ShoppingCart,
    title: 'Build your squad',
    body: 'A new Career starts you with unknown journeymen — so signing a real player in the Transfers market is always an upgrade. Search the market, grab free agents, or poach a rival’s star for a premium.',
  },
  {
    icon: Users,
    title: 'Tactics & chemistry',
    body: 'Pick a formation and field your XI in Tactics. Players sharing a tag — club, nation or playing style — form synergies: each active tag adds +10% attack and defence to the whole side.',
  },
  {
    icon: TrendingUp,
    title: 'Climb the pyramid',
    body: 'Each Career season is a league. Finish high to win promotion, finish in the drop zone to fall. Win the Premier League to be Champions of England. Difficulty (Easy / Standard / Hardcore) sets how ruthless your board is.',
  },
  {
    icon: Briefcase,
    title: 'A manager’s career',
    body: 'Get sacked? It’s not game over. Apply for jobs that match your reputation and take over a new club — your reputation and trophy cabinet follow you wherever you manage.',
  },
];

/** First-time onboarding: name your club, then a quick tour of the mechanics. */
export default function OnboardingModal({ tutorialOnly, onClose }: OnboardingModalProps) {
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);
  const existingClub = useGameStore((s) => s.clubName);
  const existingManager = useGameStore((s) => s.managerName);
  const existingKit = useGameStore((s) => s.kit);

  // First-run is ONE identity step (name + kit together) then straight into the
  // game — the mechanics are taught by coach-marks at first contact, not by a
  // lecture before kick-off (design-mockups/08). The 5-card tour remains as the
  // "How to play" reference for replays.
  const [stage] = useState<'identity' | 'tour'>(tutorialOnly ? 'tour' : 'identity');
  const [club, setClub] = useState(existingClub ?? '');
  const [manager, setManager] = useState(existingManager ?? '');
  const [kit, setKit] = useState<Kit>(existingKit ?? DEFAULT_KIT);
  const [card, setCard] = useState(0);

  // First-run: identity is locked in only when the tour finishes (or on skip).
  const finish = () => {
    if (!tutorialOnly) completeOnboarding(club, manager, kit);
    onClose();
  };

  const randomize = () => {
    // UI-time randomness only — never touches run seeds.
    setClub(CLUB_NAMES[Math.floor(Math.random() * CLUB_NAMES.length)]);
    setManager(MANAGER_NAMES[Math.floor(Math.random() * MANAGER_NAMES.length)]);
  };

  const Icon = CARDS[card].icon;
  const lastCard = card === CARDS.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 border-crt-dim bg-pitch-950 shadow-glow"
      >
        {/* Header */}
        <div className="border-b border-crt-dim bg-pitch-900/80 px-5 py-4 text-center">
          <div className="mx-auto mb-1 flex items-center justify-center gap-2 text-crt-green">
            <Trophy size={20} />
            <h2 className="font-display text-xl tracking-wide">
              {stage === 'identity' ? 'FOUND YOUR CLUB' : 'HOW IT WORKS'}
            </h2>
            <Sparkles size={20} />
          </div>
          <p className="text-xs text-chrome-muted">
            {stage === 'identity'
              ? 'Name it, dress it. Everything can be changed later in Club → Settings.'
              : `${card + 1} of ${CARDS.length}`}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {stage === 'identity' ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-display text-xs uppercase tracking-wide text-chrome-muted">
                  Club name
                </span>
                <input
                  value={club}
                  onChange={(e) => setClub(e.target.value.slice(0, 24))}
                  placeholder="Your XI"
                  maxLength={24}
                  data-testid="club-name-input"
                  autoFocus
                  className="rounded-md border border-white/15 bg-pitch-950 px-3 py-2 font-display text-base text-chrome placeholder:text-chrome-muted/50 focus:border-crt-green/60 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-display text-xs uppercase tracking-wide text-chrome-muted">
                  Manager name <span className="text-chrome-muted/60">(optional)</span>
                </span>
                <input
                  value={manager}
                  onChange={(e) => setManager(e.target.value.slice(0, 24))}
                  placeholder="The Gaffer"
                  maxLength={24}
                  data-testid="manager-name-input"
                  className="rounded-md border border-white/15 bg-pitch-950 px-3 py-2 font-display text-base text-chrome placeholder:text-chrome-muted/50 focus:border-crt-green/60 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={randomize}
                className="flex w-fit items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-display text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
              >
                <Dice5 size={13} /> Surprise me
              </button>
              {/* Kit — same step: one identity moment, live shirt preview */}
              <div className="rounded-lg border border-white/10 bg-pitch-900/40 p-3">
                <p className="mb-2 font-display text-xs uppercase tracking-wide text-chrome-muted">Club kit</p>
                <KitPicker value={kit} onChange={setKit} compact />
              </div>
            </div>
          ) : (
            <motion.div
              key={card}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-crt-green/40 bg-crt-green/10 text-crt-green">
                <Icon size={26} />
              </div>
              <h3 className="font-display text-lg text-chrome">{CARDS[card].title}</h3>
              <p className="max-w-sm text-sm leading-relaxed text-chrome-muted">
                {CARDS[card].body}
              </p>
              {/* Progress dots */}
              <div className="mt-1 flex items-center gap-1.5">
                {CARDS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === card ? 'w-4 bg-crt-green' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
          {stage === 'identity' ? (
            <>
              <button
                type="button"
                onClick={finish}
                data-testid="skip-onboarding"
                className="text-xs font-display text-chrome-muted hover:text-chrome"
                title="Start playing now — you can set all of this later in Club → Settings"
              >
                Skip setup
              </button>
              <button
                type="button"
                onClick={finish}
                data-testid="onboarding-finish"
                className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
              >
                <Play size={15} /> Start playing
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (card > 0) setCard((c) => c - 1);
                  else onClose(); // the tour is only ever a replay now
                }}
                className="flex items-center gap-1 text-xs font-display text-chrome-muted hover:text-chrome"
              >
                <ArrowLeft size={14} /> {card === 0 ? 'Close' : 'Prev'}
              </button>
              {lastCard ? (
                <button
                  type="button"
                  onClick={finish}
                  data-testid="onboarding-finish"
                  className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
                >
                  <Play size={15} /> {tutorialOnly ? 'Done' : 'Start playing'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCard((c) => c + 1)}
                  data-testid="onboarding-next"
                  className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
                >
                  Next <ArrowRight size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
