/**
 * Transfer market valuations (Career & League). Pure & deterministic.
 *
 * Unlike Classic's fixed authored `cost` (a roguelike draft price), a career/
 * league transfer has a **market value** derived from the player's rating and
 * inflated by the division — a 90-rated star is journeyman-priced in the
 * National League but costs Premier League money in the Premier League. This
 * makes transfers a real, scaling decision (and the main money sink) instead of
 * trivially cheap once you're established. Classic does NOT use this.
 *
 * Tuned against the career balance sim (`npm run sim`).
 */

import { overall } from './wages';
import { BOTTOM_TIER } from './league';
import { Rng } from './rng';
import type { Player, Role } from './types';

/** Convexity of the value curve — stars cost disproportionately more.
 *  Tuned so a starting £50M comfortably fields a lower-league XI (overall ~62 ≈
 *  £2M) while stars run into the tens of millions (×division inflation on top). */
const VALUE_DIV = 45;
const VALUE_EXP = 5;

/** How much each division up multiplies a player's value (richer leagues pay more). */
export const MARKET_TIER_K = 1.2;

/**
 * Career/League opening transfer kitty (£m). Higher than Classic's £50M because
 * you build an XI from scratch at MARKET value — you need enough to field a side
 * AND have the value curve stay steep enough to gate squad quality as you climb.
 * Classic keeps STARTING_BANKROLL (its roguelike draft uses cheap fixed costs).
 */
export const CAREER_STARTING_BANKROLL = 35;

/** Resale haircut: you recoup this fraction of market value when selling. */
export const MARKET_SELL_RATE = 0.85;

/**
 * Base market value (£m) from a player's overall rating — convex, so a galaxy
 * star costs many multiples of a journeyman. Division-agnostic.
 */
export function baseValue(p: Player): number {
  const o = overall(p);
  return Math.max(1, Math.round((o / VALUE_DIV) ** VALUE_EXP));
}

/** Division inflation multiplier: ×1 at the bottom tier, ×K per rung up. */
export function marketTierMult(tier: number): number {
  return MARKET_TIER_K ** (BOTTOM_TIER - tier);
}

/** A player's headline market value (£m) in a given division — what a quality
 *  player is worth, before the free-agent floor below. */
export function marketValue(p: Player, tier: number): number {
  return Math.max(1, Math.round(baseValue(p) * marketTierMult(tier)));
}

/**
 * Free-agent floor: journeyman-quality players (overall below this) are FREE
 * transfers — no fee, just a place in your squad. This guarantees you can always
 * field an XI on any budget (so a career is never bankrupt-locked), while real
 * quality still costs market value. The challenge becomes sporting, not "can I
 * afford eleven bodies." Every pitch role has free options at this threshold.
 */
export const FREE_AGENT_MAX_OVERALL = 64;

export function isFreeAgent(p: Player): boolean {
  return overall(p) < FREE_AGENT_MAX_OVERALL;
}

/** The fee to sign a player (£m): free agents cost nothing; quality costs value. */
export function transferFee(p: Player, tier: number): number {
  return isFreeAgent(p) ? 0 : marketValue(p, tier);
}

/** What selling a player nets you (£m) — free agents have no resale value. */
export function marketSellValue(p: Player, tier: number): number {
  if (isFreeAgent(p)) return 0;
  return Math.max(1, Math.round(marketValue(p, tier) * MARKET_SELL_RATE));
}

/** Premium paid to prise a player from a rival club (vs an unattached signing). */
export const POACH_PREMIUM = 1.4;

/**
 * Fee to poach a player who's owned by a rival club (£m). Always non-zero — a
 * contracted player is never a free transfer, even a journeyman — and carries a
 * premium over open-market value (you're unsettling a rival).
 */
export function poachFee(p: Player, tier: number): number {
  return Math.max(1, Math.round(marketValue(p, tier) * POACH_PREMIUM));
}

// --- Incoming offers for YOUR players -------------------------------------

/** Only your better players attract rival interest (journeymen don't). */
export const OFFER_MIN_OVERALL = 70;
/** Per-eligible-player chance of a bid in a given matchweek (then capped). */
export const OFFER_CHANCE = 0.45;
/** At most this many incoming bids land in one matchweek (no spam). */
export const MAX_OFFERS_PER_WEEK = 2;

/** A rival club bidding for a player you own. */
export interface RivalBid {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  /** Fee offered (£M). */
  fee: number;
}

/** A bidding club, with the roles its squad is still short of (need-bias). */
export interface BidderClub {
  id: string;
  name: string;
  strength: number;
  needsRoles: Role[];
}

// --- Living market: AI clubs sign players too ------------------------------

/** Per-matchweek chance that some rival club makes a signing of its own. */
export const AI_SIGNING_CHANCE = 0.3;
/** Strength a rival gains from a signing = rating × this, capped (a depth buy,
 *  not a transformation — kept modest since the balance sim can't model it). */
export const AI_SIGN_FACTOR = 0.5;
export const AI_SIGN_MAX_GAIN = 100;

export interface AiSigning {
  clubId: string;
  clubName: string;
  playerId: string;
  playerName: string;
  /** Strength the club gains (folded into its rating). */
  strengthGain: number;
}

/** A market candidate the AI can sign (open-market quality). */
export interface AiCandidate {
  id: string;
  name: string;
  /** attack + defense (matches club.strength units). */
  rating: number;
}

/**
 * Decide whether a rival club signs a player this matchweek — pure & seeded so
 * it never perturbs match results. Hungrier (weaker) clubs are likelier to act,
 * and they sign the best available candidate of a role they're short in (which
 * then leaves your market). Returns null when no signing happens.
 */
export function aiClubSigning(
  bidders: readonly BidderClub[],
  candidatesByRole: Record<string, readonly AiCandidate[]>,
  seed: string | number
): AiSigning | null {
  const rng = new Rng(`${seed}-aimkt`);
  if (rng.next() >= AI_SIGNING_CHANCE) return null;
  // Any club can strengthen (squads here start role-balanced, so signings are
  // depth/upgrade buys, not just gap-filling) — but only if SOMETHING is available.
  const rolesWithCandidates = Object.keys(candidatesByRole).filter(
    (r) => (candidatesByRole[r]?.length ?? 0) > 0
  );
  if (bidders.length === 0 || rolesWithCandidates.length === 0) return null;

  // Weight toward weaker clubs (they're hungriest for reinforcements).
  const weights = bidders.map((c) => 1 / Math.max(1, c.strength));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  let club = bidders[bidders.length - 1];
  for (let i = 0; i < bidders.length; i++) {
    r -= weights[i];
    if (r <= 0) { club = bidders[i]; break; }
  }

  // Prefer a role the club is genuinely short in; else strengthen any role.
  const needed = club.needsRoles.filter((rl) => (candidatesByRole[rl]?.length ?? 0) > 0);
  const roleOptions = needed.length ? needed : rolesWithCandidates;
  const role = roleOptions[rng.int(0, roleOptions.length - 1)];
  const cand = candidatesByRole[role][0]; // best available for that role
  const strengthGain = Math.min(AI_SIGN_MAX_GAIN, Math.round(cand.rating * AI_SIGN_FACTOR));
  return { clubId: club.id, clubName: club.name, playerId: cand.id, playerName: cand.name, strengthGain };
}

/**
 * Generate this matchweek's incoming bids for your squad — pure & deterministic
 * (seeded). Your best players draw interest; a bidder is chosen with a bias
 * toward clubs short in that role, then weighted by strength (big clubs chase
 * stars). The fee sits around market value with seeded noise. Capped per week,
 * and players already fielding an open bid are skipped (`exclude`).
 */
export function rivalBids(
  owned: readonly Player[],
  bidders: readonly BidderClub[],
  tier: number,
  seed: string | number,
  exclude: ReadonlySet<string> = new Set()
): RivalBid[] {
  if (bidders.length === 0) return [];
  const rng = new Rng(`${seed}`);
  // Stars first — they're the ones rivals come calling for.
  const eligible = owned
    .filter((p) => overall(p) >= OFFER_MIN_OVERALL && !isFreeAgent(p) && !exclude.has(p.id))
    .sort((a, b) => overall(b) - overall(a));

  const out: RivalBid[] = [];
  for (const p of eligible) {
    if (out.length >= MAX_OFFERS_PER_WEEK) break;
    if (!rng.chance(OFFER_CHANCE)) continue;
    // Prefer clubs that need this role; fall back to the whole field.
    const needers = bidders.filter((c) => c.needsRoles.includes(p.role));
    const pool = needers.length ? needers : bidders;
    // Weight the pick by strength (stronger clubs are likelier suitors).
    const total = pool.reduce((s, c) => s + Math.max(1, c.strength), 0);
    let r = rng.next() * total;
    let buyer = pool[pool.length - 1];
    for (const c of pool) {
      r -= Math.max(1, c.strength);
      if (r <= 0) { buyer = c; break; }
    }
    const fee = Math.max(1, Math.round(marketValue(p, tier) * (0.9 + rng.next() * 0.4)));
    out.push({ playerId: p.id, playerName: p.name, clubId: buyer.id, clubName: buyer.name, fee });
  }
  return out;
}
