import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowDownToLine, ListPlus, Ban, HeartCrack, Handshake, ShieldAlert,
} from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { overall, wage, LEAGUE_NEUTRAL_TIER } from '@/lib/wages';
import { sellValue } from '@/lib/economy';
import {
  marketValue, marketSellValue, transferFee, poachFee, isFreeAgent,
} from '@/lib/market';
import { isExpiring } from '@/lib/career';
import { clubOf, isWindowOpen, totalWeeks } from '@/lib/league';
import { eligiblePositions } from '@/lib/positions';
import { positionLabel } from '@/lib/playerMeta';
import { tagLabel } from '@/lib/chemistry';
import { avgRating } from '@/lib/ratings';
import { deriveStats, STAT_LABELS, type ExtendedStatKey } from '@/lib/stats';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import OvrBadge from '@/components/ui/OvrBadge';
import NegotiationModal from '@/components/shop/NegotiationModal';
import type { Player, PlayerHistory } from '@/lib/types';

const statColor = (v: number) =>
  v >= 80 ? 'text-tier-elite' : v >= 65 ? 'text-tier-ok' : v >= 50 ? 'text-tier-low' : 'text-tier-poor';
const statFill = (v: number) =>
  v >= 80 ? 'bg-tier-elite' : v >= 65 ? 'bg-tier-ok' : v >= 50 ? 'bg-tier-low' : 'bg-tier-poor';

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-9 shrink-0 font-data text-[9px] uppercase text-chrome-muted/70">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${statFill(value)}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`w-6 shrink-0 text-right font-data text-[11px] tabular-nums ${statColor(value)}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-data text-[9px] uppercase tracking-widest text-chrome-muted/70">{title}</p>
      {children}
    </div>
  );
}

/**
 * Full-screen, context-aware player profile — the FM-style "click into a player"
 * hub, reachable from the squad, the market, and rival (opponent) squads. The
 * same overlay adapts its facts + actions to whether the player is yours, a
 * market target, or owned by a rival. Surfaces data the rest of the UI hides:
 * contract length, eligible positions, full discipline record, chemistry links.
 */
export default function PlayerProfile() {
  const profilePlayerId = useGameStore((s) => s.profilePlayerId);
  const closeProfile = useGameStore((s) => s.closeProfile);
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const draft = useGameStore((s) => s.draft);
  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);
  const playerHistory = useGameStore((s) => s.playerHistory);
  const sendToBench = useGameStore((s) => s.sendToBench);
  const sell = useGameStore((s) => s.sell);
  const selectPlayer = useGameStore((s) => s.selectPlayer);

  const [confirmSell, setConfirmSell] = useState(false);
  const [negotiating, setNegotiating] = useState<Player | null>(null);

  // Reset transient action state whenever a different player is opened/closed.
  useEffect(() => { setConfirmSell(false); setNegotiating(null); }, [profilePlayerId]);
  // Escape closes the overlay.
  useEffect(() => {
    if (!profilePlayerId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeProfile(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profilePlayerId, closeProfile]);

  const p = getPlayer(profilePlayerId);

  return (
    <AnimatePresence>
      {profilePlayerId && p && (
        <Body
          key={p.id}
          p={p}
          isOwned={owned.includes(p.id)}
          onPitch={xi.includes(p.id)}
          rivalClub={!owned.includes(p.id) && league ? clubOf(league, p.id) : null}
          marketMode={!!(career || (league && !draft))}
          draftLeague={draft !== null}
          windowOpen={league ? isWindowOpen(league.matchweek, totalWeeks(league)) : true}
          tier={draft ? null : (career?.tier ?? (league ? LEAGUE_NEUTRAL_TIER : null))}
          meta={career?.meta?.[p.id]}
          suspended={suspensions.includes(p.id)}
          injuredRounds={(injuries as Record<string, number>)[p.id] ?? 0}
          history={playerHistory[p.id]}
          confirmSell={confirmSell}
          setConfirmSell={setConfirmSell}
          negotiating={negotiating}
          setNegotiating={setNegotiating}
          onClose={closeProfile}
          onBench={() => { sendToBench(p.id); closeProfile(); }}
          onField={() => { selectPlayer(p.id); closeProfile(); }}
          onSell={() => { sell(p.id); closeProfile(); }}
        />
      )}
    </AnimatePresence>
  );
}

interface BodyProps {
  p: Player;
  isOwned: boolean;
  onPitch: boolean;
  rivalClub: { name: string } | null;
  marketMode: boolean;
  draftLeague: boolean;
  windowOpen: boolean;
  tier: number | null;
  meta: { age: number; growthLeft: number; contractYears: number } | undefined;
  suspended: boolean;
  injuredRounds: number;
  history: PlayerHistory | undefined;
  confirmSell: boolean;
  setConfirmSell: (v: boolean) => void;
  negotiating: Player | null;
  setNegotiating: (p: Player | null) => void;
  onClose: () => void;
  onBench: () => void;
  onField: () => void;
  onSell: () => void;
}

function Body({
  p, isOwned, onPitch, rivalClub, marketMode, draftLeague, windowOpen, tier, meta,
  suspended, injuredRounds, history, confirmSell, setConfirmSell,
  negotiating, setNegotiating, onClose, onBench, onField, onSell,
}: BodyProps) {
  const ext = deriveStats(p);
  const keys: ExtendedStatKey[] =
    p.role === 'GK'
      ? ['goalkeeping', 'defending', 'passing', 'physical', 'composure', 'discipline']
      : ['pace', 'shooting', 'passing', 'defending', 'physical', 'composure', 'discipline'];
  const rs = ROLE_STYLES[p.role];
  const h = history;
  const avg = h && h.apps > 0 ? avgRating(h) : null;
  const positions = eligiblePositions(p);
  const synergy = p.synergyTags ?? p.tags ?? [];

  // Value framing depends on context.
  const ownedSale = tier !== null ? marketSellValue(p, tier) : sellValue(p);
  // Selling in a market mode is window-gated; a £0 free agent is "released",
  // not sold (so the £0 doesn't read as a broken sale).
  const sellShut = marketMode && !windowOpen;
  const isRelease = marketMode && ownedSale === 0;
  const fee = tier !== null
    ? (rivalClub ? poachFee(p, tier) : transferFee(p, tier))
    : null;
  const free = isFreeAgent(p);

  const contextLabel = isOwned
    ? (onPitch ? 'In your XI' : 'Your squad')
    : rivalClub ? `At ${rivalClub.name}` : 'On the market';

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      data-testid="player-profile"
    >
      <motion.div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-surface-1 sm:max-w-md sm:rounded-2xl"
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-white/10 bg-surface-2 px-4 py-3">
          <OvrBadge value={overall(p)} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`shrink-0 rounded px-1 py-0.5 font-data text-[10px] font-semibold ${rs.text} ${rs.bg}`}>
                {p.role}
              </span>
              <h2 className="truncate font-display text-lg leading-tight text-chrome">{p.name}</h2>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-chrome-muted">
              {p.club && <span className="text-chrome">{p.club}</span>}
              {p.era && <span> · {p.era}</span>}
              {p.nationality && <span> · {p.nationality}</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-white/5 px-1.5 py-0.5 font-data text-[9px] uppercase tracking-wide text-chrome-muted">
                {contextLabel}
              </span>
              {suspended && (
                <span className="flex items-center gap-0.5 rounded bg-rose-500 px-1.5 py-0.5 font-data text-[9px] font-bold text-white">
                  <Ban size={8} /> SUSPENDED
                </span>
              )}
              {!suspended && injuredRounds > 0 && (
                <span className="flex items-center gap-0.5 rounded bg-tier-low px-1.5 py-0.5 font-data text-[9px] font-bold text-pitch-950">
                  <HeartCrack size={8} /> INJ · {injuredRounds}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="profile-close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-chrome-muted hover:bg-white/10 hover:text-chrome"
            aria-label="Close profile"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Section title="Attributes">
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2">
              <StatLine label="ATK" value={p.stats.attack} />
              <StatLine label="DEF" value={p.stats.defense} />
              {keys.map((k) => (
                <StatLine key={k} label={STAT_LABELS[k]} value={ext[k]} />
              ))}
            </div>
          </Section>

          <Section title="Can play">
            <div className="flex flex-wrap gap-1.5">
              {positions.map((pos, i) => (
                <span
                  key={pos}
                  className={[
                    'rounded px-1.5 py-0.5 font-data text-[10px]',
                    i === 0
                      ? 'bg-crt-green/15 text-crt-green'
                      : 'bg-white/5 text-chrome-muted',
                  ].join(' ')}
                  title={i === 0 ? 'Natural position' : 'Can cover here'}
                >
                  {positionLabel(pos) ?? pos}
                </span>
              ))}
            </div>
          </Section>

          {synergy.length > 0 && (
            <Section title="Chemistry links">
              <div className="flex flex-wrap gap-1.5">
                {synergy.map((t) => (
                  <span key={t} className="rounded bg-crt-green/10 px-1.5 py-0.5 font-data text-[10px] text-crt-green/90">
                    {tagLabel(t)}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {meta && (
            <Section title="Career">
              <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                <span className="text-chrome-muted">Seasons at club</span>
                <span className="text-right font-data text-chrome">{meta.age}</span>
                <span className="text-chrome-muted">Contract</span>
                <span className="text-right font-data">
                  {isExpiring(meta)
                    ? <span className="text-crt-amber">Expiring · Bosman risk</span>
                    : <span className="text-chrome">{meta.contractYears} season{meta.contractYears !== 1 ? 's' : ''} left</span>}
                </span>
                {meta.growthLeft > 0 && (
                  <>
                    <span className="text-chrome-muted">Development</span>
                    <span className="text-right font-data text-crt-green">
                      Rising · {meta.growthLeft} season{meta.growthLeft !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {p.potential != null && (
                  <>
                    <span className="text-chrome-muted">Potential</span>
                    <span className="text-right font-data text-crt-amber">★ {p.potential}</span>
                  </>
                )}
              </div>
            </Section>
          )}

          <Section title="This run">
            {h && h.apps > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[11px]">
                <span className="text-chrome">{h.apps} app{h.apps !== 1 ? 's' : ''}</span>
                {avg !== null && <span className="text-crt-amber">★{avg.toFixed(1)}</span>}
                {h.goals > 0 && <span className="text-crt-green">{h.goals}⚽</span>}
                {h.assists > 0 && <span className="text-sky-300">{h.assists}🅰</span>}
                {h.motm > 0 && <span className="text-crt-amber">{h.motm}× MOTM</span>}
                {(h.yellows > 0 || h.reds > 0) && (
                  <span className="text-chrome-muted">
                    {h.yellows > 0 && <span className="text-yellow-300">{h.yellows}🟨</span>}
                    {h.reds > 0 && <span className="ml-1 text-rose-400">{h.reds}🟥</span>}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-chrome-muted">No appearances yet.</p>
            )}
          </Section>

          {/* Value */}
          <Section title="Valuation">
            <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
              {tier !== null && (
                <>
                  <span className="text-chrome-muted">Market value</span>
                  <span className="text-right font-data text-chrome">
                    {free ? <span className="text-crt-green">Free agent</span> : `£${marketValue(p, tier)}M`}
                  </span>
                </>
              )}
              {isOwned ? (
                <>
                  <span className="text-chrome-muted">Sell value</span>
                  <span className="text-right font-data text-chrome">{ownedSale > 0 ? `£${ownedSale}M` : '—'}</span>
                </>
              ) : fee !== null ? (
                <>
                  <span className="text-chrome-muted">{rivalClub ? 'Poach fee' : 'Transfer fee'}</span>
                  <span className="text-right font-data text-chrome">{fee > 0 ? `£${fee}M` : 'Free'}</span>
                </>
              ) : null}
              <span className="text-chrome-muted">Est. wage</span>
              <span className="text-right font-data text-chrome-muted">£{wage(p).toFixed(1)}M</span>
            </div>
          </Section>
        </div>

        {/* Context actions */}
        <div className="flex items-center gap-2 border-t border-white/10 bg-surface-2 px-4 py-3">
          {isOwned ? (
            <>
              {onPitch ? (
                <button
                  type="button"
                  onClick={onBench}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 py-2 font-display text-xs text-chrome hover:bg-white/5"
                >
                  <ArrowDownToLine size={13} /> Send to bench
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onField}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-crt-green/40 bg-crt-green/10 py-2 font-display text-xs text-crt-green hover:bg-crt-green/20"
                >
                  <ListPlus size={13} /> Field — pick a slot
                </button>
              )}
              {!draftLeague && (
                <button
                  type="button"
                  onClick={() => { if (sellShut) return; if (confirmSell) onSell(); else setConfirmSell(true); }}
                  disabled={sellShut}
                  title={sellShut ? 'Transfer window closed — sell when it reopens' : undefined}
                  data-testid={`profile-sell-${p.id}`}
                  className={[
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 font-display text-xs transition disabled:cursor-not-allowed disabled:opacity-50',
                    confirmSell
                      ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                      : 'border-rose-400/30 text-rose-300/90 hover:bg-rose-500/10',
                  ].join(' ')}
                >
                  {sellShut
                    ? 'Window shut'
                    : confirmSell
                      ? 'Sure? Tap to confirm'
                      : isRelease
                        ? 'Release'
                        : `Sell · £${ownedSale}M`}
                </button>
              )}
            </>
          ) : marketMode ? (
            <button
              type="button"
              onClick={() => setNegotiating(p)}
              data-testid={`profile-sign-${p.id}`}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 font-display text-xs transition',
                rivalClub
                  ? 'border-fuchsia-400/50 text-fuchsia-200 hover:bg-fuchsia-500/15'
                  : 'border-crt-green/50 text-crt-green hover:bg-crt-green/15',
              ].join(' ')}
            >
              {rivalClub ? <ShieldAlert size={13} /> : <Handshake size={13} />}
              {rivalClub ? `Negotiate poach${fee ? ` · £${fee}M` : ''}` : free ? 'Agree terms · free' : `Negotiate${fee ? ` · £${fee}M` : ''}`}
            </button>
          ) : (
            <p className="flex-1 text-center text-[11px] text-chrome-muted">Scouting view</p>
          )}
        </div>
      </motion.div>

      {/* Reuse the full transfer-negotiation flow for market/poach actions. */}
      {negotiating && (
        <NegotiationModal
          key={negotiating.id}
          player={negotiating}
          onClose={() => { setNegotiating(null); onClose(); }}
        />
      )}
    </motion.div>
  );
}
