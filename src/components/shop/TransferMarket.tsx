import { useEffect, useMemo, useState } from 'react';
import { Search, Wand2, Lock, Users, ArrowDown, ArrowUp } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { POOL } from '@/data/pool';
import { overall, LEAGUE_NEUTRAL_TIER, wageBill, wageBudget, wageTierMult, tierMult } from '@/lib/wages';
import { transferFee, poachFee } from '@/lib/market';
import { division, isWindowOpen, nextWindowOpensAt, totalWeeks } from '@/lib/league';
import { computeChemistry } from '@/lib/chemistry';
import { filterAndSortMarket } from '@/lib/marketFilter';
import { ROSTER_CAP } from '@/lib/economy';
import type { Player, Position, Role } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { positionShort, positionLabel } from '@/lib/playerMeta';
import OvrBadge from '@/components/ui/OvrBadge';
import NegotiationModal from './NegotiationModal';

type RoleFilter = 'ALL' | Role;
const ROLE_FILTERS: RoleFilter[] = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];
type Segment = 'free' | 'open' | 'rivals';
type SortKey = 'overall' | 'value' | 'name';
type PosFilter = 'ALL' | Position;
const POS_FILTERS: PosFilter[] = [
  'ALL', 'Goalkeeper', 'CenterBack', 'Fullback', 'Anchor', 'BoxToBox', 'Playmaker', 'Winger', 'Striker',
];
/** Rows shown per page — "Show more" loads another page, so no player is ever
 *  cut off (the old hard MAX_ROWS=60 buried the cheap/low-rated long tail). */
const PAGE = 60;

const SEGMENTS: { id: Segment; title: string; blurb: string }[] = [
  { id: 'free', title: 'Free agents', blurb: 'Under 64 OVR · always £0 — you can never be stuck' },
  { id: 'open', title: 'Open market', blurb: 'Unattached players · pay market value' },
  { id: 'rivals', title: 'At rivals', blurb: 'Poach from this division — +40% fee, weakens their season' },
];

/**
 * The Career/League transfer market, structured around its three tiers —
 * free agents / open market / poach targets — each segment teaching its own
 * rule, with the money context (bank · wage budget · squad) pinned on top
 * (design-mockups/03-market.html).
 */
export default function TransferMarket() {
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const bankroll = useGameStore((s) => s.bankroll);
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const autoFillSquad = useGameStore((s) => s.autoFillSquad);
  const openProfile = useGameStore((s) => s.openProfile);

  const [role, setRole] = useState<RoleFilter>('ALL');
  const [segment, setSegment] = useState<Segment>('open');
  const [query, setQuery] = useState('');
  const [negotiating, setNegotiating] = useState<Player | null>(null);
  // FM-style filters/sort — surface the whole pool, not just the top 60.
  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [sortDesc, setSortDesc] = useState(true);
  const [position, setPosition] = useState<PosFilter>('ALL');
  const [minFee, setMinFee] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  const tier = career?.tier ?? LEAGUE_NEUTRAL_TIER;
  const divName = career ? division(career.tier).name : 'League';

  // Transfer window: signings/sales are only allowed while it's open.
  const weeks = league ? totalWeeks(league) : 0;
  const windowOpen = league ? isWindowOpen(league.matchweek, weeks) : true;
  const reopensAt = league ? nextWindowOpensAt(league.matchweek, weeks) : null;

  const starters = useMemo(
    () => xi.map((id) => getPlayer(id)).filter((p): p is Player => !!p),
    [xi]
  );
  const ownedSet = useMemo(() => new Set(owned), [owned]);

  // Wage context — the single most missable number in the old UI.
  const dm = tierMult(career ? career.tier : LEAGUE_NEUTRAL_TIER);
  const wageMult = career ? wageTierMult(career.tier) : 1;
  const wage = Math.round(wageBill(owned.map(getPlayer).filter((p): p is Player => !!p)) * wageMult);
  const budget = wageBudget(bankroll, dm);
  const overBudget = wage > budget;

  // Map each rival-owned player id → its club name (poach targets).
  const clubByPlayer = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of league?.clubs ?? []) {
      for (const id of c.squad ?? []) m.set(id, c.name);
    }
    return m;
  }, [league]);

  const feeOf = (p: Player) => (clubByPlayer.has(p.id) ? poachFee(p, tier) : transferFee(p, tier));

  const lo = minFee.trim() === '' ? null : Number(minFee);
  const hi = maxFee.trim() === '' ? null : Number(maxFee);

  const { rows, total } = useMemo(() => {
    const list = filterAndSortMarket(POOL, {
      segment, role, position, query, minFee: lo, maxFee: hi,
      affordableOnly, bankroll, sortKey, sortDesc, ownedSet,
      isAtClub: (id) => clubByPlayer.has(id), feeOf,
    });
    return { rows: list, total: list.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedSet, role, position, segment, query, tier, bankroll, clubByPlayer, lo, hi, affordableOnly, sortKey, sortDesc]);

  // Any filter/sort change resets paging to the first page.
  useEffect(() => {
    setVisible(PAGE);
  }, [role, position, segment, query, minFee, maxFee, affordableOnly, sortKey, sortDesc]);

  const shown = rows.slice(0, visible);

  const full = owned.length >= ROSTER_CAP;

  return (
    <div className="flex flex-col gap-3" data-testid="transfer-market">
      {/* Money context — pinned: bank · wage bill vs budget · squad count */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-surface-1 px-3 py-2">
          <p className="font-data text-[9px] uppercase tracking-wider text-chrome-muted/70">Bank</p>
          <p className="font-data text-[15px] text-crt-amber">£{bankroll}M</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface-1 px-3 py-2">
          <p className="font-data text-[9px] uppercase tracking-wider text-chrome-muted/70">Wages / budget</p>
          <p className="font-data text-[15px]">
            <span className={overBudget ? 'text-rose-300' : 'text-chrome'}>£{wage}M</span>
            <span className="text-[11px] text-chrome-muted"> / £{budget}M</span>
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${overBudget ? 'bg-tier-poor' : 'bg-tier-elite'}`}
              style={{ width: `${Math.min(100, Math.round((wage / Math.max(budget, 1)) * 100))}%` }}
            />
          </div>
        </div>
        <div className={`rounded-xl border px-3 py-2 ${full ? 'border-rose-400/40 bg-rose-500/10' : 'border-white/10 bg-surface-1'}`}>
          <p className="font-data text-[9px] uppercase tracking-wider text-chrome-muted/70">Squad{full ? ' · full' : ''}</p>
          <p className={`font-data text-[15px] ${full ? 'text-rose-200' : 'text-chrome'}`}>
            {owned.length}<span className="text-[11px] text-chrome-muted"> / {ROSTER_CAP}</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Transfer Market</h2>
          <div className="flex items-center gap-2">
            <span className="font-data text-[11px] text-chrome-muted">{divName} prices</span>
            <button
              type="button"
              onClick={autoFillSquad}
              disabled={!windowOpen}
              data-testid="auto-fill"
              title={windowOpen ? 'Fill empty XI slots with the best free agents (£0) — a legal side in one tap' : 'Transfer window closed'}
              className="flex items-center gap-1 rounded-md border border-crt-green/40 bg-crt-green/10 px-2 py-1.5 text-xs font-display text-crt-green transition hover:bg-crt-green/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wand2 size={13} />
              <span className="hidden sm:inline">Fill (free)</span>
            </button>
          </div>
        </div>

        {/* Transfer-window status */}
        {league &&
          (windowOpen ? (
            <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-crt-green/25 bg-crt-green/5 px-3 py-1.5 font-data text-[11px] text-crt-green">
              <span className="h-1.5 w-1.5 rounded-full bg-crt-green" />
              Transfer window open · matchweek {league.matchweek}
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-crt-amber/30 bg-crt-amber/5 px-3 py-1.5 font-data text-[11px] text-crt-amber" data-testid="window-closed">
              <Lock size={12} />
              Transfer window closed{reopensAt ? ` — reopens matchweek ${reopensAt}` : ' for the rest of the season'}. Browse now, deal then.
            </div>
          ))}

        {/* Squad full — the real reason signings are blocked (a desktop tooltip
            on each button was invisible on mobile). */}
        {full && (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/5 px-3 py-1.5 font-data text-[11px] text-rose-200" data-testid="squad-full">
            <Users size={12} /> Squad full ({ROSTER_CAP}/{ROSTER_CAP}) — sell or release a player before you can sign another.
          </div>
        )}

        {/* The three market tiers — each teaches its own rule */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSegment(s.id)}
              data-testid={`segment-${s.id}`}
              className={[
                'rounded-xl border px-2.5 py-2 text-left transition',
                segment === s.id
                  ? 'border-crt-green/50 bg-crt-green/10'
                  : 'border-white/10 bg-surface-1 hover:border-white/25',
              ].join(' ')}
            >
              <span className={`block font-display text-[13px] leading-tight ${segment === s.id ? 'text-crt-green' : 'text-chrome'}`}>
                {s.title}
              </span>
              <span className="mt-0.5 hidden text-[10px] leading-tight text-chrome-muted sm:block">{s.blurb}</span>
            </button>
          ))}
        </div>
        {/* Mobile: show the active segment's rule under the row */}
        <p className="mb-3 text-[10px] text-chrome-muted sm:hidden">
          {SEGMENTS.find((s) => s.id === segment)?.blurb}
        </p>

        {/* Controls */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={[
                  'rounded-full border px-2.5 py-1 text-xs font-display transition',
                  role === r
                    ? 'border-crt-green bg-crt-green/20 text-crt-green'
                    : 'border-white/10 text-chrome-muted hover:bg-white/5 hover:text-chrome',
                ].join(' ')}
              >
                {r === 'ALL' ? 'All' : r}
              </button>
            ))}
          </div>
          <div className="relative ml-auto flex items-center">
            <Search size={13} className="absolute left-2 text-chrome-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players…"
              data-testid="market-search"
              className="w-40 rounded-md border border-white/10 bg-pitch-950 py-1 pl-7 pr-2 text-xs text-chrome placeholder:text-chrome-muted focus:border-crt-green/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Sort + filters — surface bargains (value ↑) and the long tail */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-data text-[10px] uppercase tracking-wider text-chrome-muted/70">Sort</span>
          {([['overall', 'Overall'], ['value', 'Fee'], ['name', 'Name']] as [SortKey, string][]).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => (sortKey === k ? setSortDesc((d) => !d) : (setSortKey(k), setSortDesc(k !== 'name')))}
              data-testid={`sort-${k}`}
              title={k === 'value' ? 'Sort by fee — flip to value ↑ to find bargains' : `Sort by ${lbl.toLowerCase()}`}
              className={[
                'flex items-center gap-0.5 rounded-md border px-2 py-1 font-display text-xs transition',
                sortKey === k
                  ? 'border-crt-green/50 bg-crt-green/10 text-crt-green'
                  : 'border-white/10 text-chrome-muted hover:bg-white/5 hover:text-chrome',
              ].join(' ')}
            >
              {lbl}
              {sortKey === k && (sortDesc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAffordableOnly((a) => !a)}
            data-testid="filter-affordable"
            className={[
              'rounded-md border px-2 py-1 font-display text-xs transition',
              affordableOnly
                ? 'border-crt-green/50 bg-crt-green/10 text-crt-green'
                : 'border-white/10 text-chrome-muted hover:bg-white/5 hover:text-chrome',
            ].join(' ')}
          >
            Affordable
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((f) => !f)}
            data-testid="toggle-filters"
            className={[
              'ml-auto rounded-md border px-2 py-1 font-display text-xs transition',
              showFilters || position !== 'ALL' || lo !== null || hi !== null
                ? 'border-crt-green/50 bg-crt-green/10 text-crt-green'
                : 'border-white/10 text-chrome-muted hover:bg-white/5 hover:text-chrome',
            ].join(' ')}
          >
            Filters{position !== 'ALL' || lo !== null || hi !== null ? ' ·' : ''}
          </button>
        </div>

        {/* Advanced filters — position + fee range */}
        {showFilters && (
          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-surface-1 px-3 py-2.5">
            <label className="flex flex-col gap-1">
              <span className="font-data text-[10px] uppercase tracking-wider text-chrome-muted/70">Position</span>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as PosFilter)}
                data-testid="filter-position"
                className="rounded-md border border-white/10 bg-pitch-950 px-2 py-1 text-xs text-chrome focus:border-crt-green/50 focus:outline-none"
              >
                {POS_FILTERS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos === 'ALL' ? 'All positions' : positionLabel(pos)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-data text-[10px] uppercase tracking-wider text-chrome-muted/70">Min fee £M</span>
              <input
                type="number"
                min={0}
                value={minFee}
                onChange={(e) => setMinFee(e.target.value)}
                placeholder="0"
                data-testid="filter-fee-min"
                className="w-20 rounded-md border border-white/10 bg-pitch-950 px-2 py-1 text-xs text-chrome placeholder:text-chrome-muted focus:border-crt-green/50 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-data text-[10px] uppercase tracking-wider text-chrome-muted/70">Max fee £M</span>
              <input
                type="number"
                min={0}
                value={maxFee}
                onChange={(e) => setMaxFee(e.target.value)}
                placeholder="any"
                data-testid="filter-fee-max"
                className="w-20 rounded-md border border-white/10 bg-pitch-950 px-2 py-1 text-xs text-chrome placeholder:text-chrome-muted focus:border-crt-green/50 focus:outline-none"
              />
            </label>
            {(position !== 'ALL' || lo !== null || hi !== null) && (
              <button
                type="button"
                onClick={() => { setPosition('ALL'); setMinFee(''); setMaxFee(''); }}
                className="rounded-md border border-white/10 px-2 py-1 font-display text-xs text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* List — browsable but visibly dormant when the window is shut */}
        <div className={`flex flex-col gap-1.5 ${!windowOpen ? 'opacity-70 saturate-50' : ''}`}>
          {shown.map((p) => {
            const atClub = clubByPlayer.get(p.id);
            const fee = feeOf(p);
            const free = fee === 0;
            const rs = ROLE_STYLES[p.role];
            const withC = computeChemistry([...starters, p]);
            const pc = withC.perPlayer.find((x) => x.player.id === p.id);
            const bonus = pc ? Math.round((pc.multiplier - 1) * 100) : 0;
            const affordable = bankroll >= fee && !full;
            const signable = affordable && windowOpen;
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-pitch-950/40 px-2.5 py-1.5"
              >
                <span className={`w-9 shrink-0 rounded px-1 py-0.5 text-center font-data text-[10px] font-semibold ${rs.text} ${rs.bg}`}>
                  {p.position ? positionShort(p.position) : p.role}
                </span>
                <button
                  type="button"
                  onClick={() => openProfile(p.id)}
                  data-testid={`profile-open-${p.id}`}
                  title="View full profile"
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-display text-sm text-chrome transition-colors hover:text-crt-green">{p.name}</p>
                  <p className="truncate text-[10px] text-chrome-muted">
                    {atClub ? <span className="text-fuchsia-300">at {atClub}</span> : `${p.club} · ${p.era}`}
                  </p>
                </button>
                {bonus > 0 && (
                  <span className="shrink-0 font-data text-[11px] text-crt-green" title="Chemistry this player would add to your current XI">
                    +{bonus}%
                  </span>
                )}
                <OvrBadge value={overall(p)} />
                <button
                  type="button"
                  onClick={() => setNegotiating(p)}
                  disabled={!signable}
                  data-testid={`sign-${p.id}`}
                  title={
                    !windowOpen
                      ? 'Transfer window closed'
                      : full
                        ? 'Squad full'
                        : affordable
                          ? atClub ? `Negotiate a poach (~£${fee}M) — weakens ${atClub}` : free ? 'Agree terms (free)' : `Open negotiations (~£${fee}M)`
                          : `Need £${fee}M`
                  }
                  className={[
                    'flex w-24 shrink-0 flex-col items-center justify-center rounded-lg border px-2 py-1 font-display text-[11px] leading-tight transition',
                    atClub
                      ? 'border-fuchsia-400/50 text-fuchsia-200 hover:bg-fuchsia-500/15'
                      : free
                        ? 'border-crt-green/50 text-crt-green hover:bg-crt-green/15'
                        : 'border-crt-amber/40 text-crt-amber hover:bg-crt-amber/10',
                    !signable && 'cursor-not-allowed opacity-40',
                  ].join(' ')}
                >
                  <span>{atClub ? `Poach · £${fee}M` : free ? 'Sign · Free' : `Buy · £${fee}M`}</span>
                  {atClub && <span className="font-data text-[8px] uppercase tracking-wide opacity-75">weakens them</span>}
                </button>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="py-6 text-center text-xs text-chrome-muted">
              {segment === 'rivals' && !league
                ? 'No rival squads in this mode.'
                : 'No players match your filters.'}
            </p>
          )}
        </div>

        {shown.length < total && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            data-testid="show-more"
            className="mt-3 w-full rounded-lg border border-white/15 py-2 font-display text-xs text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
          >
            Show more · {total - shown.length} more
          </button>
        )}

        <p className="mt-3 text-[11px] text-chrome-muted">
          Showing {shown.length} of {total} · tap a price to open negotiations
        </p>

        {negotiating && (
          <NegotiationModal
            key={negotiating.id}
            player={negotiating}
            onClose={() => setNegotiating(null)}
          />
        )}
      </div>
    </div>
  );
}
