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
