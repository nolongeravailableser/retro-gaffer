import { describe, it, expect } from 'vitest';
import {
  needsAction, actionCount, offerMessage, expectationMessage, resultMessage, injuryMessage,
} from '@/lib/inbox';

describe('inbox triage — needsAction', () => {
  const offer = offerMessage(3, { playerId: 'p1', playerName: 'X', clubId: 'c', clubName: 'C', fee: 20 });
  const pledge = expectationMessage(1, 2, 'win promotion');

  it('an open bid needs action', () => {
    expect(needsAction(offer)).toBe(true);
  });

  it('a resolved bid no longer needs action', () => {
    expect(needsAction({ ...offer, resolved: 'rejected' })).toBe(false);
  });

  it('an unanswered pledge needs action', () => {
    expect(needsAction(pledge)).toBe(true);
  });

  it('an answered pledge no longer needs action', () => {
    expect(needsAction({ ...pledge, pledge: 'accept' })).toBe(false);
  });

  it('FYI records never need action', () => {
    expect(needsAction(resultMessage(3, 'Town', 2, 1))).toBe(false);
    expect(needsAction(injuryMessage(3, 'p2', 'Y', 2))).toBe(false);
  });

  it('actionCount tallies only the actionable', () => {
    const inbox = [offer, pledge, resultMessage(3, 'Town', 1, 1), { ...offer, id: 'x', resolved: 'accepted' as const }];
    expect(actionCount(inbox)).toBe(2);
  });
});
