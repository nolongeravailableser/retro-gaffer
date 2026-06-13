import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * A one-time contextual hint shown at first contact with a screen — the
 * show-don't-tell replacement for the pre-game mechanics lecture
 * (design-mockups/08). Dismissal persists per device (not per save: the
 * mechanics don't change between runs, so neither should the teaching).
 */
const KEY = (id: string) => `gaffer-coach-${id}`;

interface CoachMarkProps {
  id: string;
  children: React.ReactNode;
}

export default function CoachMark({ id, children }: CoachMarkProps) {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(KEY(id)) === '1';
    } catch {
      return true; // storage blocked — never nag
    }
  });
  if (seen) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY(id), '1');
    } catch {
      /* no-op */
    }
    setSeen(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="flex items-start gap-2.5 rounded-xl border border-sky-300/40 bg-sky-300/[0.07] px-3.5 py-2.5"
        data-testid={`coach-${id}`}
      >
        <span className="text-base leading-none">👋</span>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-chrome-muted">{children}</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 font-display text-[11px] text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
        >
          Got it
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
