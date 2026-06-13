import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Hexagon, ArrowLeftRight, LayoutPanelTop, ArrowRight, ArrowLeft, X } from 'lucide-react';
import type { Tab } from '@/components/nav/MainNav';

/**
 * First-career guided tour. The per-tab CoachMarks teach a screen once you reach
 * it, but a new manager has no map of HOW to move between tabs — so this walks
 * the four pages in order (it actually switches the tab behind the card so you
 * see the real screen), explaining what each is for and what to do next.
 *
 * One-time per device (career mechanics don't change between runs), career-only,
 * shown after onboarding so the two don't collide.
 */
const KEY = 'gaffer-career-tour';

export function careerTourSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked — never nag
  }
}

interface Step {
  tab: Tab;
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    tab: 'home',
    icon: Home,
    title: 'Home — match day',
    body: (
      <>Your fixture, the league table, the cup and your <b className="text-chrome">inbox</b>. Kick off
      from the big button up top — the edge bar tells you whether you're favoured before you commit.</>
    ),
  },
  {
    tab: 'squad',
    icon: Hexagon,
    title: 'Squad — your tactics board',
    body: (
      <>Pick your XI: tap <b className="text-chrome">any player</b> for his profile, then Field him into
      a slot — or just hit <b className="text-crt-green">Auto-Pick</b>. Green pips are chemistry links
      (players sharing a club, nation or era boost each other).</>
    ),
  },
  {
    tab: 'market',
    icon: ArrowLeftRight,
    title: 'Market — sign players',
    body: (
      <>Spend your <b className="text-crt-amber">bank</b> to strengthen the squad — free agents are
      always £0. Keep an eye on the <b className="text-chrome">wage budget</b> (a bloated wage bill
      bites), and sort by <b className="text-chrome">Fee ↑</b> to hunt bargains.</>
    ),
  },
  {
    tab: 'club',
    icon: LayoutPanelTop,
    title: 'Club — the bigger picture',
    body: (
      <>Your <b className="text-chrome">finances</b>, stadium &amp; facilities, season history and
      honours. This is where your manager legacy is tracked — it carries across clubs as you climb.</>
    ),
  },
];

interface CareerTourProps {
  onGoToTab: (tab: Tab) => void;
  onFinish: () => void;
}

export default function CareerTour({ onGoToTab, onFinish }: CareerTourProps) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // Switch the tab behind the card so the manager sees the real screen.
  useEffect(() => {
    onGoToTab(step.tab);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* no-op */
    }
    onFinish();
  };

  const Icon = step.icon;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 pt-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          data-testid="career-tour"
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-crt-green/40 bg-pitch-950/95 p-4 shadow-glow backdrop-blur"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-crt-green/40 bg-crt-green/10 text-crt-green">
              <Icon size={16} />
            </span>
            <h3 className="flex-1 font-display text-base text-chrome">{step.title}</h3>
            <button
              type="button"
              onClick={finish}
              aria-label="Skip the tour"
              data-testid="career-tour-skip"
              className="rounded-full border border-white/15 p-1 text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
            >
              <X size={14} />
            </button>
          </div>

          <p className="mb-3 text-xs leading-relaxed text-chrome-muted">{step.body}</p>

          <div className="flex items-center justify-between">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, n) => (
                <span
                  key={n}
                  className={`h-1.5 rounded-full transition-all ${n === i ? 'w-4 bg-crt-green' : 'w-1.5 bg-white/20'}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setI((n) => n - 1)}
                  className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 font-display text-xs text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
                >
                  <ArrowLeft size={13} /> Back
                </button>
              )}
              <button
                type="button"
                onClick={() => (last ? finish() : setI((n) => n + 1))}
                data-testid="career-tour-next"
                className="flex items-center gap-1 rounded-lg border border-crt-green/50 bg-crt-green/15 px-3 py-1.5 font-display text-xs text-crt-green transition hover:bg-crt-green/25"
              >
                {last ? "Let's go" : <>Next <ArrowRight size={13} /></>}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
