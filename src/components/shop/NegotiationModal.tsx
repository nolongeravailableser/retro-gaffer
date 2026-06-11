import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Handshake, Gavel, BadgePoundSterling, AlertTriangle } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { overall, wageBill, wageBudget, tierMult, LEAGUE_NEUTRAL_TIER } from '@/lib/wages';
import { transferFee, poachFee } from '@/lib/market';
import { clubOf, division } from '@/lib/league';
import { wageDemand, evaluateBid, termsAffordable } from '@/lib/negotiation';
import type { Player } from '@/lib/types';

interface Props {
  /** The player being signed; null closes the modal. */
  player: Player | null;
  onClose: () => void;
}

type Stage = 'club' | 'terms';

/**
 * FM-style transfer negotiation. Two steps:
 *   1. Club — bid for the player; the selling side accepts / counters / rejects
 *      (skipped for free agents, who have no fee).
 *   2. Personal terms — the player's wage demand; over your wage budget ⇒ he
 *      refuses. Agreeing commits the signing via `signPlayer(id, agreedFee)`.
 */
export default function NegotiationModal({ player, onClose }: Props) {
  const bankroll = useGameStore((s) => s.bankroll);
  const owned = useGameStore((s) => s.owned);
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const runSeed = useGameStore((s) => s.runSeed);
  const signPlayer = useGameStore((s) => s.signPlayer);

  const tier = career?.tier ?? LEAGUE_NEUTRAL_TIER;
  const club = player && league ? clubOf(league, player.id) : null;
  const asking = player ? (club ? poachFee(player, tier) : transferFee(player, tier)) : 0;
  const counterparty = club ? club.name : player?.club ?? 'the club';

  // Personal-terms numbers.
  const demand = player ? wageDemand(player, tier) : 0;
  const currentBill = useMemo(
    () => wageBill(owned.map(getPlayer).filter((p): p is Player => !!p)),
    [owned]
  );
  const budget = wageBudget(bankroll, tierMult(tier));
  const wagesOk = player ? termsAffordable(demand, currentBill, budget) : false;

  // Local negotiation state.
  const [stage, setStage] = useState<Stage>('club');
  const [bid, setBid] = useState<number>(asking);
  const [attempt, setAttempt] = useState(0);
  const [clubMsg, setClubMsg] = useState<string | null>(null);
  const [counter, setCounter] = useState<number | null>(null);
  const [agreedFee, setAgreedFee] = useState<number>(asking);

  // Re-seed all per-player state whenever the modal opens for a new player.
  // (Keyed render below guarantees a fresh mount, so plain initial state is fine.)

  if (!player) return null;

  const free = asking === 0;
  const startStage: Stage = free ? 'terms' : stage;
  const affordFee = (fee: number) => bankroll >= fee;

  const submitBid = () => {
    const v = evaluateBid(asking, bid, `${runSeed}-${player.id}-${attempt}`);
    setAttempt((a) => a + 1);
    if (v.result === 'accept') {
      setAgreedFee(bid);
      setCounter(null);
      setClubMsg(`${counterparty} accepted your £${bid}M bid.`);
      setStage('terms');
    } else if (v.result === 'counter' && v.counter != null) {
      setCounter(v.counter);
      setClubMsg(`${counterparty} rejected £${bid}M but will sell for £${v.counter}M.`);
    } else {
      setCounter(null);
      setClubMsg(`${counterparty} rejected your £${bid}M bid as derisory.`);
    }
  };

  const acceptCounter = () => {
    if (counter == null) return;
    setAgreedFee(counter);
    setBid(counter);
    setClubMsg(`Agreed a £${counter}M fee with ${counterparty}.`);
    setStage('terms');
  };

  const commit = () => {
    signPlayer(player.id, free ? 0 : agreedFee);
    onClose();
  };

  const divName = career ? division(tier).name : 'League';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border-2 border-crt-dim bg-pitch-950 shadow-glow"
          data-testid="negotiation-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-crt-dim bg-pitch-900/80 px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg text-crt-green">{player.name}</h2>
              <p className="font-ticker text-[11px] text-chrome-muted">
                {player.position ?? player.role} · OVR {overall(player)} · {divName}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="text-chrome-muted hover:text-chrome">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-3 px-5 py-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 font-display text-[11px] uppercase tracking-wide">
              <span className={startStage === 'club' ? 'text-crt-green' : 'text-chrome-muted'}>
                <Gavel size={12} className="mr-1 inline" />1 · Fee
              </span>
              <span className="text-chrome-muted">→</span>
              <span className={startStage === 'terms' ? 'text-crt-green' : 'text-chrome-muted'}>
                <Handshake size={12} className="mr-1 inline" />2 · Terms
              </span>
            </div>

            {startStage === 'club' && (
              <>
                <p className="font-ticker text-xs text-chrome-muted">
                  {club ? (
                    <>
                      <span className="text-fuchsia-300">{counterparty}</span> hold his registration —
                      poaching him weakens them. Asking <span className="text-crt-amber">£{asking}M</span>.
                    </>
                  ) : (
                    <>
                      Valued at <span className="text-crt-amber">£{asking}M</span> ({counterparty}). Make
                      your bid.
                    </>
                  )}
                </p>

                <label className="flex items-center gap-2">
                  <BadgePoundSterling size={16} className="text-crt-amber" />
                  <input
                    type="number"
                    min={1}
                    value={bid}
                    onChange={(e) => setBid(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    data-testid="bid-input"
                    className="w-28 rounded-md border border-white/10 bg-pitch-900 px-2 py-1.5 text-sm text-chrome focus:border-crt-green/50 focus:outline-none"
                  />
                  <span className="font-ticker text-xs text-chrome-muted">£M bid</span>
                </label>

                {clubMsg && (
                  <p className="font-ticker text-xs text-chrome" data-testid="club-message">
                    {clubMsg}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitBid}
                    disabled={bid <= 0 || !affordFee(bid)}
                    data-testid="submit-bid"
                    className="rounded-md border border-crt-green/50 px-3 py-1.5 font-display text-xs text-crt-green transition hover:bg-crt-green/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Submit bid
                  </button>
                  {counter != null && (
                    <button
                      type="button"
                      onClick={acceptCounter}
                      disabled={!affordFee(counter)}
                      data-testid="accept-counter"
                      className="rounded-md border border-crt-amber/50 px-3 py-1.5 font-display text-xs text-crt-amber transition hover:bg-crt-amber/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Accept £{counter}M
                    </button>
                  )}
                </div>
                {!affordFee(bid) && bid > 0 && (
                  <p className="font-ticker text-[11px] text-rose-300">You only have £{bankroll}M.</p>
                )}
              </>
            )}

            {startStage === 'terms' && (
              <>
                {!free && (
                  <p className="font-ticker text-xs text-chrome-muted">
                    Fee agreed: <span className="text-crt-amber">£{agreedFee}M</span>. Now his wage
                    demands:
                  </p>
                )}
                {free && (
                  <p className="font-ticker text-xs text-chrome-muted">
                    Free transfer — agree personal terms to complete the signing.
                  </p>
                )}

                <div className="rounded-lg border border-white/10 bg-pitch-900/50 p-3 font-ticker text-xs">
                  <div className="flex justify-between">
                    <span className="text-chrome-muted">Wage demand</span>
                    <span className="text-chrome">£{demand}M / wk</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-chrome-muted">Current wage bill</span>
                    <span className="text-chrome">£{currentBill}M / wk</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-chrome-muted">Wage budget</span>
                    <span className={wagesOk ? 'text-crt-green' : 'text-rose-300'}>£{budget}M / wk</span>
                  </div>
                </div>

                {!wagesOk && (
                  <p className="flex items-start gap-1.5 font-ticker text-[11px] text-rose-300">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    His demands blow your wage budget — he won't join. Sell, climb a division, or chase a
                    cheaper target.
                  </p>
                )}

                <button
                  type="button"
                  onClick={commit}
                  disabled={!wagesOk || (!free && !affordFee(agreedFee))}
                  data-testid="agree-terms"
                  className="rounded-md border border-crt-green/60 bg-crt-green/10 px-3 py-2 font-display text-sm text-crt-green transition hover:bg-crt-green/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {free ? 'Agree terms & sign (free)' : `Agree terms & sign · £${agreedFee}M`}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
