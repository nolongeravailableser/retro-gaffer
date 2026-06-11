/**
 * The club inbox (Career & League) — an FM-style message feed that ties the
 * world together. Match results, injuries, board verdicts and incoming transfer
 * bids all land here instead of flashing past as a one-shot toast, so the player
 * always has a record of what just happened and what needs a decision.
 *
 * Pure & deterministic: messages are built from already-seeded game data and
 * stamped with the MATCHWEEK (not wall-clock time), so a replay is identical and
 * the determinism rule holds. Classic never generates inbox messages.
 */

export type InboxKind =
  | 'result' // a matchweek result recap
  | 'injury' // a player picked up a knock
  | 'board' // promotion / relegation / title verdict
  | 'offer' // a rival club bids for one of your players (actionable)
  | 'transfer' // a completed transfer (in/out)
  | 'achievement'; // an unlocked achievement

/** A rival's bid for one of your players — the payload an `offer` message acts on. */
export interface OfferPayload {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  /** Fee offered (£M). */
  fee: number;
}

export interface InboxMessage {
  /** Deterministic, stable id (`kind-week-key`) — also the React key. */
  id: string;
  /** Matchweek the message was generated on (the "timestamp"). */
  week: number;
  kind: InboxKind;
  title: string;
  body: string;
  read: boolean;
  /** Present on actionable `offer` messages. */
  offer?: OfferPayload;
  /** Resolution of an actionable message once the player has decided. */
  resolved?: 'accepted' | 'rejected';
}

/** Keep the inbox bounded — the freshest messages, newest first. */
export const INBOX_CAP = 60;

/** Count of unread messages (drives the tab badge). */
export function unreadCount(inbox: readonly InboxMessage[]): number {
  let n = 0;
  for (const m of inbox) if (!m.read) n++;
  return n;
}

/**
 * Prepend new messages (newest first) and cap the list. De-dupes by id so a
 * re-resolved matchweek can't double-post (idempotent on replay).
 */
export function pushMessages(
  inbox: readonly InboxMessage[],
  incoming: readonly InboxMessage[],
  cap = INBOX_CAP
): InboxMessage[] {
  if (incoming.length === 0) return inbox as InboxMessage[];
  const have = new Set(inbox.map((m) => m.id));
  const fresh = incoming.filter((m) => !have.has(m.id));
  if (fresh.length === 0) return inbox as InboxMessage[]; // nothing new → same ref
  return [...fresh, ...inbox].slice(0, cap);
}

// --- builders (pure) -------------------------------------------------------

/** Recap of the player's own matchweek fixture. */
export function resultMessage(
  week: number,
  opponent: string,
  scored: number,
  conceded: number
): InboxMessage {
  const verb = scored > conceded ? 'Beat' : scored < conceded ? 'Lost to' : 'Drew with';
  return {
    id: `result-${week}`,
    week,
    kind: 'result',
    title: `Matchweek ${week}: ${scored}–${conceded}`,
    body: `${verb} ${opponent} ${scored}–${conceded}.`,
    read: false,
  };
}

/** A player has picked up an injury (post-medical-reduction duration). */
export function injuryMessage(
  week: number,
  playerId: string,
  playerName: string,
  weeksOut: number
): InboxMessage {
  return {
    id: `injury-${week}-${playerId}`,
    week,
    kind: 'injury',
    title: `Injury: ${playerName}`,
    body: `${playerName} is out for ${weeksOut} week${weeksOut === 1 ? '' : 's'}.`,
    read: false,
  };
}

/** A board / season-verdict note (promotion, relegation, title, survival). */
export function boardMessage(week: number, title: string, body: string): InboxMessage {
  return { id: `board-${week}`, week, kind: 'board', title, body, read: false };
}

/** An incoming bid from a rival club for one of your players (actionable). */
export function offerMessage(week: number, offer: OfferPayload): InboxMessage {
  return {
    id: `offer-${week}-${offer.playerId}`,
    week,
    kind: 'offer',
    title: `Bid: ${offer.clubName} want ${offer.playerName}`,
    body: `${offer.clubName} have offered £${offer.fee}M for ${offer.playerName}. Accept to cash in, or reject and keep him.`,
    read: false,
    offer,
  };
}
