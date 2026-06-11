import { describe, it, expect } from 'vitest';
import {
  pushMessages,
  unreadCount,
  resultMessage,
  injuryMessage,
  boardMessage,
  offerMessage,
  INBOX_CAP,
  type InboxMessage,
} from '@/lib/inbox';

describe('inbox', () => {
  it('builds deterministic, kind-tagged messages', () => {
    const r = resultMessage(3, 'Selby Athletic', 2, 1);
    expect(r.id).toBe('result-3');
    expect(r.kind).toBe('result');
    expect(r.body).toContain('Beat Selby Athletic');
    expect(injuryMessage(4, 'p_x', 'Henry', 1).body).toContain('1 week.'); // singular
    expect(injuryMessage(4, 'p_x', 'Henry', 3).body).toContain('3 weeks');
    expect(boardMessage(5, 'Verdict', 'Promoted!').kind).toBe('board');
    const o = offerMessage(6, { playerId: 'p_y', playerName: 'Kane', clubId: 'ai1', clubName: 'Marsh Town', fee: 40 });
    expect(o.id).toBe('offer-6-p_y');
    expect(o.offer?.fee).toBe(40);
  });

  it('prepends newest-first and de-dupes by id (idempotent on replay)', () => {
    const a = resultMessage(1, 'A', 1, 0);
    const b = resultMessage(2, 'B', 0, 0);
    const list = pushMessages(pushMessages([], [a]), [b]);
    expect(list.map((m) => m.id)).toEqual(['result-2', 'result-1']); // newest first
    // Re-pushing the same id is a no-op (no double-post).
    expect(pushMessages(list, [b])).toBe(list);
  });

  it('caps the inbox at INBOX_CAP', () => {
    const many: InboxMessage[] = Array.from({ length: INBOX_CAP + 10 }, (_, i) =>
      boardMessage(i, `t${i}`, 'x')
    );
    const list = pushMessages([], many);
    expect(list.length).toBe(INBOX_CAP);
  });

  it('counts unread messages', () => {
    const list = [resultMessage(1, 'A', 1, 0), { ...resultMessage(2, 'B', 0, 0), read: true }];
    expect(unreadCount(list)).toBe(1);
  });
});
