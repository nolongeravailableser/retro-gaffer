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
  | 'morale' // a player's mood (man-management)
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
  /** A board message you can respond to (accept the challenge / temper it). */
  pledgeable?: boolean;
  /** Your remembered response to a pledgeable message. */
  pledge?: 'accept' | 'temper';
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
 * Whether a message still demands a decision from the manager — an unresolved
 * incoming bid or an unanswered board pledge. Everything else is an FYI record.
 * Drives the triaged inbox (Action Needed vs the collapsed Updates digest).
 */
export function needsAction(m: InboxMessage): boolean {
  return (m.kind === 'offer' && !m.resolved) || (!!m.pledgeable && !m.pledge);
}

/** Count of messages awaiting a decision (drives the "action needed" badge). */
export function actionCount(inbox: readonly InboxMessage[]): number {
  let n = 0;
  for (const m of inbox) if (needsAction(m)) n++;
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

/** The commercial team confirms the season's sponsorship income (once per season). */
export function sponsorshipMessage(
  week: number,
  season: number,
  divName: string,
  amount: number
): InboxMessage {
  return {
    id: `sponsor-${season}`,
    week,
    kind: 'board',
    title: 'Sponsorship secured',
    body: `Commercial deals for the ${divName} season are worth £${amount}M.`,
    read: false,
  };
}

/** The board's pre-season expectation — an interactive pledge (once per season). */
export function expectationMessage(week: number, season: number, expectation: string): InboxMessage {
  return {
    id: `board-expect-${season}`,
    week,
    kind: 'board',
    title: 'The board sets out its expectations',
    body: `The owner expects you to ${expectation} this season. Will you accept the challenge, or temper their expectations?`,
    read: false,
    pledgeable: true,
  };
}

/** End-of-season payoff when you made a pledge (the board remembers). */
export function pledgePayoffMessage(
  week: number,
  season: number,
  pledge: 'accept' | 'temper',
  met: boolean
): InboxMessage {
  const body =
    pledge === 'accept'
      ? met
        ? 'You accepted the board\'s challenge and delivered — the owner is delighted and the bonus reflects it.'
        : 'You accepted the board\'s challenge and fell short. The owner is unimpressed; the bonus is docked and patience is wearing thin.'
      : met
        ? 'You tempered expectations and quietly over-delivered — the board is pleasantly surprised.'
        : 'You managed expectations and a tough season was accepted without fuss.';
  return {
    id: `board-payoff-${season}`,
    week,
    kind: 'board',
    title: met ? 'The board is pleased' : 'The board takes stock',
    body,
    read: false,
  };
}

/** A mid-season warning when board confidence sours (once per season). */
export function confidenceWarning(week: number, season: number): InboxMessage {
  return {
    id: `board-warn-${season}`,
    week,
    kind: 'board',
    title: 'The board is growing concerned',
    body: 'Results have the owner worried — the mood in the boardroom has soured. A turnaround is needed to win them back.',
    read: false,
  };
}

/** A rival club has made a signing of its own (the living market moves). */
export function signingMessage(week: number, clubName: string, playerId: string, playerName: string): InboxMessage {
  return {
    id: `aimkt-${week}-${playerId}`,
    week,
    kind: 'transfer',
    title: `${clubName} strengthen`,
    body: `${clubName} have signed ${playerName} from the open market — one fewer target for you.`,
    read: false,
  };
}

/** Players who left the club on free transfers (expired contracts / Bosman). */
export function departureMessage(week: number, season: number, names: readonly string[]): InboxMessage {
  const n = names.length;
  return {
    id: `bosman-${season}`,
    week,
    kind: 'transfer',
    title: `${n} player${n === 1 ? '' : 's'} left on a free`,
    body: `Out of contract — left on a Bosman: ${names.join(', ')}.`,
    read: false,
  };
}

/** A player has grown unhappy (lack of football / poor form). Stable id → posts
 *  once per player, so it never spams. */
export function moraleMessage(week: number, playerId: string, playerName: string): InboxMessage {
  return {
    id: `morale-${playerId}`,
    week,
    kind: 'morale',
    title: `${playerName} is unhappy`,
    body: `${playerName} has grown unsettled — short on form or starved of football. Give him minutes, or he'll agitate to leave.`,
    read: false,
  };
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
