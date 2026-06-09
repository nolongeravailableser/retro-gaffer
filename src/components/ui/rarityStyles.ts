import type { Rarity } from '@/lib/types';

/** Card framing per rarity tier — border, ambient glow, and label chip. */
export const RARITY_STYLES: Record<
  Rarity,
  { frame: string; chip: string; label: string; ring: string }
> = {
  bronze: {
    frame: 'border-amber-800/60 bg-gradient-to-b from-amber-950/40 to-pitch-800/80',
    chip: 'bg-amber-800/30 text-amber-300/90',
    label: 'Bronze',
    ring: 'ring-amber-700/40',
  },
  silver: {
    frame: 'border-slate-400/40 bg-gradient-to-b from-slate-700/30 to-pitch-800/80',
    chip: 'bg-slate-400/20 text-slate-200',
    label: 'Silver',
    ring: 'ring-slate-300/40',
  },
  gold: {
    frame:
      'border-yellow-400/60 bg-gradient-to-b from-yellow-700/30 to-pitch-800/85 shadow-[0_0_14px_rgba(250,204,21,0.18)]',
    chip: 'bg-yellow-400/25 text-yellow-200',
    label: 'Gold',
    ring: 'ring-yellow-300/50',
  },
  icon: {
    frame:
      'border-fuchsia-400/60 bg-gradient-to-b from-fuchsia-800/30 via-violet-800/20 to-pitch-900/85 shadow-[0_0_18px_rgba(217,70,239,0.28)]',
    chip: 'bg-fuchsia-400/25 text-fuchsia-200',
    label: 'Icon',
    ring: 'ring-fuchsia-300/60',
  },
};
