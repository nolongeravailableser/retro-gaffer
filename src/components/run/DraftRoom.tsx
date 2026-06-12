import { useState } from 'react';
import { motion } from 'framer-motion';
import { Gavel, Check, Search, ArrowDown, ArrowUp } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { currentTeam, DRAFT_NEED, DRAFT_SQUAD_SIZE } from '@/lib/draft';
import { overall } from '@/lib/wages';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['GK', 'DEF', 'MID', 'FWD'];
const ROLE_FILTERS: Array<Role | 'ALL'> = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];
type SortKey = 'value' | 'rating';

/** A simple tier colour for a 0–99-ish stat, so skill level reads at a glance. */
function statColor(v: number): string {
  if (v >= 80) return 'text-crt-green';
  if (v >= 65) return 'text-crt-amber';
  if (v >= 50) return 'text-orange-300';
  return 'text-rose-300';
}

/**
 * The Classic draft board. Browse the FULL pool — filter by position, search by
 * name, sort by value or rating — and pick freely (any role you can afford) from
 * the very first pick. Clear attributes (overall + ATK/DEF) on every card. You
 * draft a full 16-man squad (XI + 5 subs); the AI clubs pick instantly around you.
 */
export default function DraftRoom() {
  const draft = useGameStore((s) => s.draft);
  const draftPick = useGameStore((s) => s.draftPick);
  const [filter, setFilter] = useState<Role | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [desc, setDesc] = useState(true);
  const [affordableOnly, setAffordableOnly] = useState(false);

  if (!draft || currentTeam(draft) !== 0) return null;

  const you = draft.teams[0];

  // Role coverage vs a legal XI; what you still need.
  const have: Record<string, number> = {};
  for (const id of you.roster) {
    const r = draft.meta[id]?.role;
    if (r) have[r] = (have[r] ?? 0) + 1;
  }
  const stillNeeds = (role: Role) => Math.max(0, DRAFT_NEED[role] - (have[role] ?? 0));
  const needs = ROLES.filter((r) => stillNeeds(r) > 0);
  const requiredLeft = needs.reduce((s, r) => s + stillNeeds(r), 0);
  const picksLeft = DRAFT_SQUAD_SIZE - you.roster.length;
  const mustFill = picksLeft <= requiredLeft; // final picks reserved for needed roles

  // Cheapest available per role + overall — the always-pickable last resorts.
  const cheapestByRole: Partial<Record<Role, number>> = {};
  let cheapestAll = Infinity;
  for (const id of draft.pool) {
    const m = draft.meta[id];
    if (!m) continue;
    if (cheapestByRole[m.role] === undefined || m.value < cheapestByRole[m.role]!) cheapestByRole[m.role] = m.value;
    if (m.value < cheapestAll) cheapestAll = m.value;
  }
  const pickable = (id: string): boolean => {
    const m = draft.meta[id];
    if (mustFill && stillNeeds(m.role) === 0) return false; // must fill required roles now
    if (m.value <= you.budget) return true;
    if (stillNeeds(m.role) > 0) return m.value === cheapestByRole[m.role];
    if (requiredLeft === 0) return m.value === cheapestAll;
    return false;
  };

  const q = search.trim().toLowerCase();
  const dir = desc ? -1 : 1;
  const list = draft.pool
    .filter((id) => filter === 'ALL' || draft.meta[id]?.role === filter)
    .filter((id) => !affordableOnly || pickable(id))
    .filter((id) => !q || (getPlayer(id)?.name ?? '').toLowerCase().includes(q))
    .sort((a, b) => {
      const ma = draft.meta[a], mb = draft.meta[b];
      const key = sortKey === 'value' ? mb.value - ma.value : mb.rating - ma.rating;
      return dir * -key; // `key` is already high-first; apply direction
    })
    .slice(0, 200);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 p-3">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 border-crt-amber bg-pitch-950 shadow-glow"
      >
        {/* Header: progress + budget + role needs */}
        <div className="border-b border-crt-dim bg-pitch-900/80 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-base text-crt-amber">
              <Gavel size={19} /> The Draft
            </span>
            <span className="font-ticker text-xs text-chrome-muted">
              Pick {you.roster.length + 1}/{DRAFT_SQUAD_SIZE} · budget{' '}
              <span className="text-crt-green">£{you.budget}M</span>
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 font-ticker text-[11px]">
            {ROLES.map((r) => {
              const need = stillNeeds(r);
              return (
                <span key={r} className={`rounded px-1.5 py-0.5 ${need > 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-crt-green/15 text-crt-green'}`}>
                  {r} {have[r] ?? 0}/{DRAFT_NEED[r]}{need === 0 && <Check size={10} className="ml-0.5 inline" />}
                </span>
              );
            })}
            {mustFill && requiredLeft > 0 && (
              <span className="rounded bg-crt-amber/20 px-1.5 py-0.5 text-crt-amber">Fill your XI to finish</span>
            )}
          </div>
        </div>

        {/* Controls: position tabs + search + sort + affordable */}
        <div className="space-y-2 border-b border-crt-dim px-3 py-2">
          <div className="flex items-center gap-1.5">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 font-display text-xs transition ${filter === f ? 'bg-crt-green/20 text-crt-green' : 'text-chrome-muted hover:text-chrome'}`}
              >
                {f === 'ALL' ? 'All' : f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5 rounded-md border border-crt-dim bg-pitch-900/60 px-2">
              <Search size={13} className="text-chrome-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search players…"
                className="w-full bg-transparent py-1.5 text-sm text-chrome placeholder:text-chrome-muted/50 focus:outline-none"
              />
            </div>
            {(['value', 'rating'] as SortKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => (sortKey === k ? setDesc((d) => !d) : (setSortKey(k), setDesc(true)))}
                className={`flex items-center gap-0.5 rounded-md px-2 py-1.5 font-display text-xs transition ${sortKey === k ? 'bg-crt-green/15 text-crt-green' : 'text-chrome-muted hover:text-chrome'}`}
              >
                {k === 'value' ? 'Value' : 'Rating'}
                {sortKey === k && (desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAffordableOnly((a) => !a)}
              className={`rounded-md px-2 py-1.5 font-display text-xs transition ${affordableOnly ? 'bg-crt-green/15 text-crt-green' : 'text-chrome-muted hover:text-chrome'}`}
            >
              Affordable
            </button>
          </div>
        </div>

        {/* Player list */}
        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {list.length === 0 && <p className="py-6 text-center text-sm text-chrome-muted">No players match.</p>}
          {list.map((id) => {
            const p = getPlayer(id);
            const m = draft.meta[id];
            const ovr = p ? overall(p) : 0;
            const can = pickable(id);
            return (
              <div key={id} className="flex items-center gap-2.5 rounded-lg border border-crt-dim bg-pitch-900/50 px-2.5 py-1.5">
                <span className="w-9 shrink-0 rounded bg-white/5 py-0.5 text-center font-display text-[11px] text-chrome">{m?.role}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm text-chrome">{p?.name ?? id}</p>
                  <p className="font-ticker text-[10px] text-chrome-muted">{p?.position ?? m?.role} · {p?.era ?? ''}</p>
                </div>
                {/* Clear skill readout: overall + ATK/DEF */}
                <div className="flex shrink-0 items-center gap-2 font-ticker text-[11px]">
                  <span className="text-center">
                    <span className={`block font-display text-sm ${statColor(ovr)}`}>{ovr}</span>
                    <span className="text-[9px] uppercase text-chrome-muted">OVR</span>
                  </span>
                  <span className="hidden w-16 sm:block">
                    <span className="flex justify-between"><span className="text-chrome-muted">ATK</span><span className={statColor(p?.stats.attack ?? 0)}>{p?.stats.attack}</span></span>
                    <span className="flex justify-between"><span className="text-chrome-muted">DEF</span><span className={statColor(p?.stats.defense ?? 0)}>{p?.stats.defense}</span></span>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => draftPick(id)}
                  className={`shrink-0 rounded border px-2.5 py-1 font-display text-xs transition ${can ? 'border-crt-green text-crt-green hover:bg-crt-green hover:text-pitch-950' : 'border-white/10 text-chrome-muted/40'}`}
                  title={can ? '' : mustFill ? 'Fill your remaining XI positions first' : 'Over budget'}
                >
                  £{m?.value}M
                </button>
              </div>
            );
          })}
        </div>

        <p className="border-t border-crt-dim bg-pitch-900/40 px-4 py-1.5 text-center text-[11px] text-chrome-muted">
          Draft a full 16-man squad — an XI plus 5 subs. No transfers after, so pick your cover.
        </p>
      </motion.div>
    </div>
  );
}
