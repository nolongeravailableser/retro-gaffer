import { useState } from 'react';
import { motion } from 'framer-motion';
import { Gavel, Check } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import {
  pickableInDraft, currentTeam, DRAFT_NEED, DRAFT_SQUAD_SIZE,
} from '@/lib/draft';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['GK', 'DEF', 'MID', 'FWD'];
const ROLE_FILTERS: Array<Role | 'ALL'> = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];

/**
 * The Classic draft board (shown while a draft is in progress). You pick your
 * squad in snake order against 11 AI clubs — they pick instantly around you, so
 * it's always your turn here. The reserve guard means you can always complete a
 * legal XI within budget.
 */
export default function DraftRoom() {
  const draft = useGameStore((s) => s.draft);
  const draftPick = useGameStore((s) => s.draftPick);
  const [filter, setFilter] = useState<Role | 'ALL'>('ALL');

  if (!draft || currentTeam(draft) !== 0) return null;

  const you = draft.teams[0];
  const round = Math.floor(draft.pick / draft.teams.length) + 1;

  // Your role coverage vs what a legal XI needs.
  const have: Record<string, number> = {};
  for (const id of you.roster) {
    const r = draft.meta[id]?.role;
    if (r) have[r] = (have[r] ?? 0) + 1;
  }
  const stillNeeds = (role: Role) => Math.max(0, DRAFT_NEED[role] - (have[role] ?? 0));
  const neededRoles = new Set(ROLES.filter((r) => stillNeeds(r) > 0));

  // The cheapest available of each role — the "last resort" that's always
  // pickable for a still-needed role (so a depleted market never strands you).
  const cheapestByRole: Partial<Record<Role, number>> = {};
  for (const id of draft.pool) {
    const m = draft.meta[id];
    if (m && (cheapestByRole[m.role] === undefined || m.value < cheapestByRole[m.role]!)) {
      cheapestByRole[m.role] = m.value;
    }
  }
  // Surface what you can actually PICK first: affordable players, plus the
  // last-resort cheapest of a still-needed role — so a tight budget always shows
  // options. Then best-rated within that. While your XI is incomplete, needed
  // roles outrank the rest (role-first).
  const cheapestOverall = Math.min(...draft.pool.map((id) => draft.meta[id].value));
  const canTake = (id: string) => {
    const m = draft.meta[id];
    if (m.value <= you.budget) return true;
    // Last resort: the cheapest of a still-needed role, or — once the XI is
    // complete — the cheapest player left, so the squad always fills.
    if (neededRoles.size) return neededRoles.has(m.role) && m.value === cheapestByRole[m.role];
    return m.value === cheapestOverall;
  };
  const rank = (id: string) => {
    const m = draft.meta[id];
    const needBonus = neededRoles.size && !neededRoles.has(m.role) ? 0 : 1; // role-first
    return (canTake(id) ? 2 : 0) + needBonus;
  };
  const available = draft.pool
    .filter((id) => filter === 'ALL' || draft.meta[id]?.role === filter)
    .sort((a, b) => rank(b) - rank(a) || draft.meta[b].rating - draft.meta[a].rating)
    .slice(0, 40);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 p-3">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 border-crt-amber bg-pitch-950 shadow-glow"
      >
        {/* Header */}
        <div className="border-b border-crt-dim bg-pitch-900/80 px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-base text-crt-amber">
              <Gavel size={20} /> The Draft
            </span>
            <span className="font-ticker text-xs text-chrome-muted">
              Round {round}/{DRAFT_SQUAD_SIZE} · your pick
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="font-display text-sm text-chrome">
              Budget <span className="text-crt-green">£{you.budget}M</span>
            </span>
            <span className="flex flex-wrap gap-1.5 font-ticker text-[11px]">
              {ROLES.map((r) => {
                const need = stillNeeds(r);
                return (
                  <span
                    key={r}
                    className={`rounded px-1.5 py-0.5 ${
                      need > 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-crt-green/15 text-crt-green'
                    }`}
                  >
                    {r} {have[r] ?? 0}/{DRAFT_NEED[r]}
                    {need === 0 && <Check size={10} className="ml-0.5 inline" />}
                  </span>
                );
              })}
            </span>
          </div>
        </div>

        {/* Role filter */}
        <div className="flex gap-1.5 border-b border-crt-dim px-4 py-2">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 font-display text-xs transition ${
                filter === f ? 'bg-crt-green/20 text-crt-green' : 'text-chrome-muted hover:text-chrome'
              }`}
            >
              {f === 'ALL' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* Available players */}
        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
          {available.map((id) => {
            const p = getPlayer(id);
            const m = draft.meta[id];
            const pickable = pickableInDraft(draft, 0, id);
            return (
              <div
                key={id}
                className="flex items-center gap-3 rounded-lg border border-crt-dim bg-pitch-900/50 px-3 py-2"
              >
                <span className="w-9 shrink-0 rounded bg-white/5 py-0.5 text-center font-display text-[11px] text-chrome">
                  {m?.role}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm text-chrome">{p?.name ?? id}</p>
                  <p className="font-ticker text-[10px] text-chrome-muted">
                    {p?.position ?? m?.role} · {p?.era ?? ''}
                  </p>
                </div>
                <span className="shrink-0 font-ticker text-[11px] text-chrome-muted">
                  ★{m?.rating}
                </span>
                <button
                  type="button"
                  disabled={!pickable}
                  onClick={() => draftPick(id)}
                  className={`shrink-0 rounded border px-2.5 py-1 font-display text-xs transition ${
                    pickable
                      ? 'border-crt-green text-crt-green hover:bg-crt-green hover:text-pitch-950'
                      : 'border-white/10 text-chrome-muted/40'
                  }`}
                  title={pickable ? '' : 'Over budget, or would leave you unable to field a full XI'}
                >
                  £{m?.value}M
                </button>
              </div>
            );
          })}
        </div>

        <p className="border-t border-crt-dim bg-pitch-900/40 px-5 py-2 text-center text-[11px] text-chrome-muted">
          Pick a full squad ({DRAFT_SQUAD_SIZE}) — fill the red roles to field a legal XI.
        </p>
      </motion.div>
    </div>
  );
}
