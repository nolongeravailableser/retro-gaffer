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
        {/* Header: occasion + budget bar + role needs (design-mockups/09) */}
        <div className="border-b border-crt-dim bg-gradient-to-b from-crt-amber/10 to-pitch-900/80 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-2 font-display text-base tracking-wide text-crt-amber">
              <Gavel size={19} /> DRAFT NIGHT
            </span>
            <span className="animate-pulse rounded-full border border-crt-amber/50 px-2.5 py-0.5 font-data text-[10px] uppercase tracking-wider text-crt-amber">
              On the clock · pick {you.roster.length + 1} of {DRAFT_SQUAD_SIZE}
            </span>
          </div>
          {/* Budget bar — makes the hidden XI-reserve guard visible */}
          {(() => {
            const spent = you.roster.reduce((s, id) => s + (draft.meta[id]?.value ?? 0), 0);
            const reserve = ROLES.reduce(
              (s, r) => s + stillNeeds(r) * (cheapestByRole[r] ?? 0),
              0
            );
            const total = spent + you.budget;
            const free = Math.max(0, you.budget - reserve);
            const pct = (n: number) => `${total > 0 ? Math.round((n / total) * 100) : 0}%`;
            return (
              <div className="mt-2">
                <div className="flex justify-between font-data text-[9px] uppercase tracking-wider text-chrome-muted">
                  <span>Budget £{total}M</span>
                  <span>
                    spent £{spent}M{reserve > 0 && <> · <span className="text-sky-300">reserved for XI £{reserve}M</span></>} · free <span className="text-crt-green">£{free}M</span>
                  </span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <div className="bg-crt-amber/80" style={{ width: pct(spent) }} />
                  <div className="flex-1" />
                  <div className="bg-sky-300/50" style={{ width: pct(reserve) }} />
                </div>
              </div>
            );
          })()}
          <div className="mt-2 flex flex-wrap gap-1.5 font-data text-[11px]">
            {ROLES.map((r) => {
              const need = stillNeeds(r);
              return (
                <span key={r} className={`rounded px-1.5 py-0.5 ${need > 0 ? 'border border-crt-amber/40 text-crt-amber' : 'bg-crt-green/15 text-crt-green'}`}>
                  {r} {have[r] ?? 0}/{DRAFT_NEED[r]}{need > 0 ? ` · need ${need}` : ''}{need === 0 && <Check size={10} className="ml-0.5 inline" />}
                </span>
              );
            })}
            {mustFill && requiredLeft > 0 && (
              <span className="rounded bg-crt-amber/20 px-1.5 py-0.5 text-crt-amber">Final picks — fill your XI</span>
            )}
          </div>
          {/* Rival room — their latest picks, so the 11 AI clubs feel present */}
          {(() => {
            const latest = draft.teams
              .slice(1)
              .map((t) => ({ club: t.name, pick: t.roster.at(-1) }))
              .filter((x): x is { club: string; pick: string } => !!x.pick)
              .slice(-3);
            if (latest.length === 0) return null;
            return (
              <p className="mt-1.5 truncate font-data text-[10px] text-chrome-muted">
                {latest.map((x, i) => (
                  <span key={x.club}>
                    {i > 0 && ' · '}
                    <span className="text-chrome">{x.club}</span> took {getPlayer(x.pick)?.name ?? x.pick} £{draft.meta[x.pick]?.value}M
                  </span>
                ))}
                <span className="text-chrome-muted/60"> · · · your pick</span>
              </p>
            );
          })()}
          {/* Your picks so far */}
          {you.roster.length > 0 && (
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
              {you.roster.map((id) => (
                <span key={id} className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-pitch-950/60 px-2 py-0.5 font-data text-[10px] text-chrome-muted">
                  <span className="text-chrome-muted/60">{draft.meta[id]?.role}</span>
                  <span className="text-chrome">{getPlayer(id)?.name ?? id}</span>
                </span>
              ))}
            </div>
          )}
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
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-center font-display text-xs leading-tight transition ${can ? 'border-crt-amber/50 text-crt-amber hover:bg-crt-amber hover:text-pitch-950' : 'border-white/10 text-chrome-muted/40'}`}
                  title={can ? `Draft for £${m?.value}M` : mustFill ? 'Fill your remaining XI positions first' : 'Would break your XI reserve'}
                >
                  {can ? <>Draft · £{m?.value}M</> : (
                    <>
                      £{m?.value}M
                      <span className="block font-data text-[8px] normal-case text-chrome-muted/60">
                        {mustFill && stillNeeds(m.role) === 0 ? 'XI roles first' : 'breaks XI reserve'}
                      </span>
                    </>
                  )}
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
