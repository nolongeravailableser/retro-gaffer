import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Sparkles, ShoppingCart, Users, Swords, CalendarDays,
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
    icon: ShoppingCart,
    title: 'Draft your squad',
    body: 'Sign players in the Transfers tab from rotating themed packs. Refresh for new offers, scout for a specific role, and grab the discounted Featured Free Agent each day.',
  },
  {
    icon: Users,
    title: 'Tactics & chemistry',
    body: 'Pick a formation and field your XI in Tactics. Players sharing a tag — club, nation or playing style — form synergies: each active tag adds +10% attack and defence to the whole side.',
  },
  {
    icon: Swords,
    title: 'Climb the season',
    body: 'Each round is a tougher rival. Win to bank prize money, interest and streak bonuses; lose and you drop a life. Run out of lives and you are sacked. Watch for the bosses at rounds 4, 8 and 12.',
  },
  {
    icon: CalendarDays,
    title: 'Modes & the Daily',
    body: 'Beyond Classic there is Endless, optional run mutators, authored Scenarios, a multi-season Career, and a shared Daily Gauntlet everyone plays on the same seed. Find them under New Game and Daily.',
  },
];

/** First-time onboarding: name your club, then a quick tour of the mechanics. */
export default function OnboardingModal({ tutorialOnly, onClose }: OnboardingModalProps) {
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);
  const existingClub = useGameStore((s) => s.clubName);
  const existingManager = useGameStore((s) => s.managerName);
  const existingKit = useGameStore((s) => s.kit);

  const [stage, setStage] = useState<'club' | 'kit' | 'tour'>(tutorialOnly ? 'tour' : 'club');
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
              {stage === 'club' ? 'WELCOME, GAFFER' : stage === 'kit' ? 'DESIGN YOUR KIT' : 'HOW IT WORKS'}
            </h2>
            <Sparkles size={20} />
          </div>
          <p className="text-xs text-chrome-muted">
            {stage === 'club'
              ? 'Name your club and take charge.'
              : stage === 'kit'
                ? 'The colours your XI will wear on the pitch.'
                : `${card + 1} of ${CARDS.length}`}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {stage === 'club' ? (
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
            </div>
          ) : stage === 'kit' ? (
            <KitPicker value={kit} onChange={setKit} />
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
          {stage === 'club' ? (
            <>
              {tutorialOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-display text-chrome-muted hover:text-chrome"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  data-testid="skip-onboarding"
                  className="text-xs font-display text-chrome-muted hover:text-chrome"
                  title="Start playing now — you can set all of this later in the Club tab"
                >
                  Skip setup
                </button>
              )}
              <button
                type="button"
                onClick={() => setStage('kit')}
                data-testid="onboarding-next"
                className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
              >
                Next <ArrowRight size={15} />
              </button>
            </>
          ) : stage === 'kit' ? (
            <>
              <button
                type="button"
                onClick={() => setStage('club')}
                className="flex items-center gap-1 text-xs font-display text-chrome-muted hover:text-chrome"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={() => setStage('tour')}
                data-testid="onboarding-next"
                className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
              >
                Next <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (card > 0) setCard((c) => c - 1);
                  else if (tutorialOnly) onClose(); // no setup stages when just replaying
                  else setStage('kit');
                }}
                className="flex items-center gap-1 text-xs font-display text-chrome-muted hover:text-chrome"
              >
                <ArrowLeft size={14} /> {card === 0 ? (tutorialOnly ? 'Close' : 'Back') : 'Prev'}
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
