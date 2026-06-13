import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/useGameStore';
import { POOL } from '@/data/pool';

/**
 * The player-profile overlay is driven by a single transient store field
 * (`profilePlayerId`) plus open/close actions. The UI (PlayerProfile.tsx) reads
 * this and derives owned/market/rival context from the rest of the store. Here we
 * just lock the store contract: open sets the id, close clears it, and it stays
 * out of the persisted save slice (it's ephemeral UI state).
 */
describe('player profile store contract', () => {
  beforeEach(() => {
    useGameStore.getState().startCareer();
  });

  it('defaults to no open profile', () => {
    expect(useGameStore.getState().profilePlayerId).toBeNull();
  });

  it('openProfile sets the id; closeProfile clears it', () => {
    const id = POOL[0].id;
    useGameStore.getState().openProfile(id);
    expect(useGameStore.getState().profilePlayerId).toBe(id);
    useGameStore.getState().closeProfile();
    expect(useGameStore.getState().profilePlayerId).toBeNull();
  });

  it('openProfile switches directly to another player', () => {
    useGameStore.getState().openProfile(POOL[0].id);
    useGameStore.getState().openProfile(POOL[1].id);
    expect(useGameStore.getState().profilePlayerId).toBe(POOL[1].id);
  });

  it('is independent of selectedPlayerId (placement) — opening a profile does not arm placement', () => {
    useGameStore.setState({ selectedPlayerId: null });
    useGameStore.getState().openProfile(POOL[0].id);
    expect(useGameStore.getState().selectedPlayerId).toBeNull();
  });
});

/**
 * R7 unified the pitch interaction: tapping a FILLED slot with nothing armed
 * opens that player's profile (it no longer silently "arms" him). With a player
 * armed (e.g. via the profile's "Field" action) a tap still places into the slot.
 */
describe('slotClicked — tap a filled slot opens the profile', () => {
  beforeEach(() => {
    useGameStore.getState().startCareer();
  });

  it('opens the profile for the occupant when nothing is armed', () => {
    const { xi } = useGameStore.getState();
    const slot = xi.findIndex((id) => !!id);
    expect(slot).toBeGreaterThanOrEqual(0); // a fresh career auto-fields an XI
    const occupant = xi[slot]!;

    useGameStore.setState({ selectedPlayerId: null, profilePlayerId: null });
    useGameStore.getState().slotClicked(slot);

    expect(useGameStore.getState().profilePlayerId).toBe(occupant);
    expect(useGameStore.getState().selectedPlayerId).toBeNull(); // not armed
  });

  it('places the armed player instead of opening a profile', () => {
    const { xi, bench } = useGameStore.getState();
    const slot = xi.findIndex((id) => !!id);
    const sub = bench[0];
    if (!sub) return; // a fresh career may field everyone — placement path covered elsewhere

    useGameStore.setState({ selectedPlayerId: sub, profilePlayerId: null });
    useGameStore.getState().slotClicked(slot);

    const after = useGameStore.getState();
    expect(after.profilePlayerId).toBeNull(); // armed → place, not profile
    expect(after.selectedPlayerId).toBeNull(); // placement clears the arm
    expect(after.xi[slot]).toBe(sub); // the armed sub now occupies the slot
  });
});
