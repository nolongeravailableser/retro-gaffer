import type { Role } from '@/lib/types';

/** Per-role accent classes, used across cards, slots and badges. */
export const ROLE_STYLES: Record<
  Role,
  { text: string; border: string; bg: string; label: string }
> = {
  GK: {
    text: 'text-yellow-300',
    border: 'border-yellow-300/40',
    bg: 'bg-yellow-300/10',
    label: 'Goalkeeper',
  },
  DEF: {
    text: 'text-sky-300',
    border: 'border-sky-300/40',
    bg: 'bg-sky-300/10',
    label: 'Defender',
  },
  MID: {
    text: 'text-emerald-300',
    border: 'border-emerald-300/40',
    bg: 'bg-emerald-300/10',
    label: 'Midfielder',
  },
  FWD: {
    text: 'text-rose-300',
    border: 'border-rose-300/40',
    bg: 'bg-rose-300/10',
    label: 'Forward',
  },
};
