import { Hono } from 'hono';

/**
 * Ciphertext relay. It stores encrypted envelopes per circle and hands them back in order.
 * It never holds a key. A circle is created by its first write, which records the SHA-256 of the
 * bearer token; later requests must present a bearer that hashes to the same value.
 */
export interface Store {
  getCircleHash(circle: string): Promise<string | null>;
  createCircle(circle: string, hash: string): Promise<void>;
  append(circle: string, envelope: string, at: number): Promise<number>;
  after(circle: string, cursor: number, limit: number): Promise<Array<{ cursor: number; envelope: string }>>;
  erase(circle: string): Promise<void>;
}

const MAX_ENVELOPE_BYTES = 256 * 1024;
const MAX_PAGE = 50;
const CIRCLE_RE = /^c-[0-9a-f]{6,32}$/;

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function createApp(store: Store, now: () => number = () => Date.now()) {
  const app = new Hono();

  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
  });

  const auth = async (circle: string, header: string | undefined, create: boolean): Promise<'ok' | 'bad' | 'created'> => {
    if (!CIRCLE_RE.test(circle) || !header?.startsWith('Bearer ')) return 'bad';
    const hash = await sha256Hex(header.slice(7));
    const known = await store.getCircleHash(circle);
    if (known === null) {
      if (!create) return 'bad';
      await store.createCircle(circle, hash);
      return 'created';
    }
    return timingSafeEqual(known, hash) ? 'ok' : 'bad';
  };

  app.get('/v1/health', (c) => c.json({ ok: true }));

  app.post('/v1/circles/:circle/envelopes', async (c) => {
    const circle = c.req.param('circle');
    const body = await c.req.text();
    if (body.length === 0 || body.length > MAX_ENVELOPE_BYTES) return c.json({ error: 'The envelope is empty or too large.' }, 413);
    let parsed: { v?: number; circle?: string; ciphertext?: string };
    try {
      parsed = JSON.parse(body) as typeof parsed;
    } catch {
      return c.json({ error: 'The envelope is not valid JSON.' }, 400);
    }
    if (parsed.v !== 1 || parsed.circle !== circle || typeof parsed.ciphertext !== 'string') return c.json({ error: 'The envelope does not match this circle.' }, 400);
    if ((await auth(circle, c.req.header('Authorization'), true)) === 'bad') return c.json({ error: 'Not allowed.' }, 401);
    const cursor = await store.append(circle, body, now());
    return c.json({ cursor }, 201);
  });

  app.get('/v1/circles/:circle/envelopes', async (c) => {
    const circle = c.req.param('circle');
    if ((await auth(circle, c.req.header('Authorization'), false)) === 'bad') return c.json({ error: 'Not allowed.' }, 401);
    const after = Number(c.req.query('after') ?? '0');
    const limit = Math.min(MAX_PAGE, Number(c.req.query('limit') ?? MAX_PAGE));
    const rows = await store.after(circle, Number.isFinite(after) ? after : 0, limit);
    return c.json({ envelopes: rows });
  });

  app.delete('/v1/circles/:circle', async (c) => {
    const circle = c.req.param('circle');
    if ((await auth(circle, c.req.header('Authorization'), false)) === 'bad') return c.json({ error: 'Not allowed.' }, 401);
    await store.erase(circle);
    return c.body(null, 204);
  });

  return app;
}

/** In-memory store for tests and local runs. */
export function memoryStore(): Store {
  const hashes = new Map<string, string>();
  const rows = new Map<string, Array<{ cursor: number; envelope: string }>>();
  let next = 1;
  return {
    async getCircleHash(c) {
      return hashes.get(c) ?? null;
    },
    async createCircle(c, h) {
      hashes.set(c, h);
      rows.set(c, []);
    },
    async append(c, e) {
      const cursor = next++;
      rows.get(c)!.push({ cursor, envelope: e });
      return cursor;
    },
    async after(c, cursor, limit) {
      return (rows.get(c) ?? []).filter((r) => r.cursor > cursor).slice(0, limit);
    },
    async erase(c) {
      hashes.delete(c);
      rows.delete(c);
    },
  };
}
