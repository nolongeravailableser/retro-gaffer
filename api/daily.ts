/**
 * Daily Gauntlet leaderboard — the project's one (tiny) backend.
 *
 * A single Vercel serverless function backed by Upstash Redis via REST:
 *   GET  /api/daily?day=YYYY-MM-DD  → top 20 [{ club, score }]
 *   POST /api/daily { day, score, club, id } → 204
 *
 * Storage: one sorted set per day (`lb:{day}`, member = anonymous client id,
 * ZADD GT keeps each player's best) + a hash for display names (`lbn:{day}`).
 * Both expire after 7 days. Returns 503 until the KV store is provisioned —
 * the client treats that as "leaderboard offline" and hides the panel.
 *
 * Scores are client-computed (casual game, no auth): bounds-checked, not
 * cheat-proof. Acceptable by design.
 */

// Minimal request/response shapes (Vercel Node runtime, no @vercel/node dep).
interface Req {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

const MAX_SCORE = 150_000; // a perfect classic run tops out well under this
const TOP_N = 20;
const TTL_SECONDS = 7 * 24 * 60 * 60;

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/** Run a Redis command pipeline over Upstash REST. */
async function pipeline(commands: (string | number)[][]): Promise<unknown[]> {
  const env = kvEnv();
  if (!env) throw new Error('kv-not-provisioned');
  const resp = await fetch(`${env.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!resp.ok) throw new Error(`kv ${resp.status}`);
  const out = (await resp.json()) as { result: unknown }[];
  return out.map((r) => r.result);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9-]{8,40}$/;

/** Yesterday/today/tomorrow in UTC — tolerates client time zones. */
function dayPlausible(day: string): boolean {
  const now = Date.now();
  for (const offset of [-1, 0, 1]) {
    const d = new Date(now + offset * 86_400_000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (key === day) return true;
  }
  return false;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const raw = req.query?.day;
      const day = Array.isArray(raw) ? raw[0] : raw;
      if (!day || !DAY_RE.test(day)) {
        res.status(400).json({ error: 'bad day' });
        return;
      }
      const [members] = await pipeline([
        ['ZRANGE', `lb:${day}`, 0, TOP_N - 1, 'REV', 'WITHSCORES'],
      ]);
      const flat = (members as string[]) ?? [];
      const ids: string[] = [];
      const scores: number[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        ids.push(flat[i]);
        scores.push(Number(flat[i + 1]));
      }
      let names: (string | null)[] = [];
      if (ids.length > 0) {
        const [got] = await pipeline([['HMGET', `lbn:${day}`, ...ids]]);
        names = (got as (string | null)[]) ?? [];
      }
      res.status(200).json({
        day,
        entries: ids.map((id, i) => ({
          id,
          club: names[i] ?? 'Anonymous FC',
          score: scores[i],
        })),
      });
      return;
    }

    if (req.method === 'POST') {
      const b = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
        day?: unknown; score?: unknown; club?: unknown; id?: unknown;
      } | null;
      const day = typeof b?.day === 'string' ? b.day : '';
      const score = typeof b?.score === 'number' ? Math.floor(b.score) : NaN;
      const club = typeof b?.club === 'string' ? b.club.trim().slice(0, 24) : '';
      const id = typeof b?.id === 'string' ? b.id : '';
      if (
        !DAY_RE.test(day) || !dayPlausible(day) ||
        !Number.isFinite(score) || score <= 0 || score > MAX_SCORE ||
        !ID_RE.test(id)
      ) {
        res.status(400).json({ error: 'bad submission' });
        return;
      }
      await pipeline([
        ['ZADD', `lb:${day}`, 'GT', score, id],
        ['HSET', `lbn:${day}`, id, club || 'Anonymous FC'],
        ['EXPIRE', `lb:${day}`, TTL_SECONDS],
        ['EXPIRE', `lbn:${day}`, TTL_SECONDS],
      ]);
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    const offline = e instanceof Error && e.message === 'kv-not-provisioned';
    res.status(offline ? 503 : 500).json({ error: offline ? 'leaderboard offline' : 'kv error' });
  }
}
