import { useState } from 'react';
import { Mail, Trophy, HeartPulse, Gavel, Megaphone, ArrowLeftRight, Frown, Check, X, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { isWindowOpen, totalWeeks } from '@/lib/league';
import { needsAction, type InboxKind, type InboxMessage } from '@/lib/inbox';

const KIND_ICON: Record<InboxKind, React.ElementType> = {
  result: Trophy,
  injury: HeartPulse,
  board: Megaphone,
  offer: Gavel,
  transfer: ArrowLeftRight,
  morale: Frown,
  achievement: Trophy,
};

const KIND_TINT: Record<InboxKind, string> = {
  result: 'text-crt-green',
  injury: 'text-rose-300',
  board: 'text-crt-amber',
  offer: 'text-fuchsia-300',
  transfer: 'text-sky-300',
  morale: 'text-orange-300',
  achievement: 'text-crt-amber',
};

/**
 * The club inbox (Career/League) — an FM-style message feed. Results, injuries
 * and board verdicts are read-only records; incoming transfer bids are
 * actionable (Accept = cash in + the player leaves; Reject = keep him).
 */
export default function InboxPanel() {
  const inbox = useGameStore((s) => s.inbox);
  const league = useGameStore((s) => s.league);
  const acceptOffer = useGameStore((s) => s.acceptOffer);
  const rejectOffer = useGameStore((s) => s.rejectOffer);
  const respondToBoard = useGameStore((s) => s.respondToBoard);
  // Accepting a bid is a sale — only allowed while the transfer window is open.
  const windowOpen = league ? isWindowOpen(league.matchweek, totalWeeks(league)) : true;

  // Triage: only consequential messages (open bids / unanswered pledges) demand
  // a tap; everything else collapses into an Updates digest so the inbox can't
  // become a wall of noise as a career lengthens.
  const action = inbox.filter(needsAction);
  const updates = inbox.filter((m) => !needsAction(m));
  // Default the digest open only when there's nothing pressing to do.
  const [showUpdates, setShowUpdates] = useState(action.length === 0);
  const rowProps = { windowOpen, onAccept: acceptOffer, onReject: rejectOffer, onPledge: respondToBoard };

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4" data-testid="inbox-panel">
      <div className="mb-3 flex items-center gap-2">
        <Mail size={18} className="text-crt-green" />
        <h2 className="font-display text-xl">Inbox</h2>
        <span className="ml-auto font-ticker text-[11px] text-chrome-muted">
          {inbox.length} message{inbox.length === 1 ? '' : 's'}
        </span>
      </div>

      {inbox.length === 0 ? (
        <p className="py-8 text-center text-xs text-chrome-muted" data-testid="inbox-empty">
          No messages yet. Match results, injuries, board verdicts and transfer bids will land here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Action needed — always visible, the only messages that demand a decision. */}
          {action.length > 0 && (
            <div data-testid="inbox-action" className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-widest text-crt-amber">
                <Bell size={11} /> Action needed · {action.length}
              </p>
              {action.map((m) => (
                <MessageRow key={m.id} m={m} {...rowProps} />
              ))}
            </div>
          )}

          {/* Updates digest — results, injuries, board notes, completed transfers. */}
          {updates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setShowUpdates((o) => !o)}
                data-testid="inbox-updates-toggle"
                className="flex items-center justify-between rounded-md px-1 py-0.5 text-left"
              >
                <span className="font-data text-[10px] uppercase tracking-widest text-chrome-muted">
                  Updates · {updates.length}
                </span>
                {showUpdates ? <ChevronUp size={14} className="text-chrome-muted" /> : <ChevronDown size={14} className="text-chrome-muted" />}
              </button>
              {showUpdates && updates.map((m) => <MessageRow key={m.id} m={m} {...rowProps} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageRow({
  m,
  windowOpen,
  onAccept,
  onReject,
  onPledge,
}: {
  m: InboxMessage;
  windowOpen: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onPledge: (id: string, choice: 'accept' | 'temper') => void;
}) {
  const Icon = KIND_ICON[m.kind];
  const tint = KIND_TINT[m.kind];
  const actionable = m.kind === 'offer' && !m.resolved;
  const pledgeable = m.pledgeable && !m.pledge;
  return (
    <div
      data-testid={`inbox-msg-${m.id}`}
      className={[
        'rounded-lg border px-3 py-2',
        m.read ? 'border-white/10 bg-pitch-950/30' : 'border-crt-green/30 bg-pitch-950/60',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <Icon size={15} className={`mt-0.5 shrink-0 ${tint}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-sm text-chrome">{m.title}</p>
            {!m.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-crt-green" />}
            <span className="ml-auto shrink-0 font-ticker text-[10px] text-chrome-muted">MW {m.week}</span>
          </div>
          <p className="mt-0.5 font-ticker text-[11px] text-chrome-muted">{m.body}</p>

          {actionable && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onAccept(m.id)}
                disabled={!windowOpen}
                title={windowOpen ? undefined : 'Transfer window closed'}
                data-testid={`offer-accept-${m.id}`}
                className="flex items-center gap-1 rounded border border-crt-green/50 px-2.5 py-1 font-display text-[11px] text-crt-green transition hover:bg-crt-green/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={12} /> Accept £{m.offer!.fee}M
              </button>
              <button
                type="button"
                onClick={() => onReject(m.id)}
                data-testid={`offer-reject-${m.id}`}
                className="flex items-center gap-1 rounded border border-white/15 px-2.5 py-1 font-display text-[11px] text-chrome-muted transition hover:bg-white/5"
              >
                <X size={12} /> Reject
              </button>
            </div>
          )}
          {m.kind === 'offer' && m.resolved && (
            <p className="mt-1 font-ticker text-[10px] text-chrome-muted">
              {m.resolved === 'accepted' ? '✓ Sold' : '✗ Bid rejected'}
            </p>
          )}

          {pledgeable && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onPledge(m.id, 'accept')}
                data-testid={`pledge-accept-${m.id}`}
                className="flex items-center gap-1 rounded border border-crt-amber/50 px-2.5 py-1 font-display text-[11px] text-crt-amber transition hover:bg-crt-amber/10"
              >
                <Check size={12} /> Accept the challenge
              </button>
              <button
                type="button"
                onClick={() => onPledge(m.id, 'temper')}
                data-testid={`pledge-temper-${m.id}`}
                className="flex items-center gap-1 rounded border border-white/15 px-2.5 py-1 font-display text-[11px] text-chrome-muted transition hover:bg-white/5"
              >
                Temper expectations
              </button>
            </div>
          )}
          {m.pledge && (
            <p className="mt-1 font-ticker text-[10px] text-crt-amber">
              {m.pledge === 'accept' ? '✓ You accepted the challenge' : '~ You tempered expectations'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
