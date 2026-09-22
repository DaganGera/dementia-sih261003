import { Hono } from 'hono';
import { cors } from 'hono/cors';

/**
 * Ciphertext relay. It stores encrypted envelopes per circle and hands them back in order.
 * It never holds a key. A circle is created by its first write, which records the SHA-256 of two tokens:
 * a bearer token (read, write, erase) and a drop token (write only). A courier carries the drop token with the
 * envelopes it forwards, so it can deliver them without being able to read or erase anything.
 */
export interface Store {
  getCircle(circle: string): Promise<{ bearerHash: string; dropHash: string } | null>;
  createCircle(circle: string, bearerHash: string, dropHash: string): Promise<void>;
  append(circle: string, envelope: string, at: number): Promise<number>;
  after(circle: string, cursor: number, limit: number): Promise<Array<{ cursor: number; envelope: string }>>;
  erase(circle: string): Promise<void>;
}

const MAX_ENVELOPE_BYTES = 256 * 1024;
const MAX_PAGE = 50;
const CIRCLE_RE = /^c-[0-9a-f]{6,32}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

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

const bearerOf = (h: string | undefined) => (h?.startsWith('Bearer ') ? h.slice(7) : null);

export function createApp(store: Store, now: () => number = () => Date.now()) {
  const app = new Hono();

  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowHeaders: ['Authorization', 'Content-Type', 'X-Drop-Hash'], maxAge: 600 }));
  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
  });

  const member = async (circle: string, header: string | undefined): Promise<'ok' | 'bad' | 'none'> => {
    const token = bearerOf(header);
    if (!CIRCLE_RE.test(circle) || !token) return 'bad';
    const known = await store.getCircle(circle);
    if (!known) return 'none';
    return timingSafeEqual(known.bearerHash, await sha256Hex(token)) ? 'ok' : 'bad';
  };

  const validEnvelope = (body: string, circle: string): string | null => {
    if (body.length === 0 || body.length > MAX_ENVELOPE_BYTES) return 'The envelope is empty or too large.';
    let parsed: { v?: number; circle?: string; ciphertext?: string };
    try {
      parsed = JSON.parse(body) as typeof parsed;
    } catch {
      return 'The envelope is not valid JSON.';
    }
    if (parsed.v !== 1 || parsed.circle !== circle || typeof parsed.ciphertext !== 'string') return 'The envelope does not match this circle.';
    return null;
  };

  app.get('/v1/health', (c) => c.json({ ok: true }));

  app.post('/v1/circles/:circle/envelopes', async (c) => {
    const circle = c.req.param('circle');
    const body = await c.req.text();
    const bad = validEnvelope(body, circle);
    if (bad) return c.json({ error: bad }, bad.includes('large') ? 413 : 400);
    const status = await member(circle, c.req.header('Authorization'));
    if (status === 'bad') return c.json({ error: 'Not allowed.' }, 401);
    if (status === 'none') {
      const token = bearerOf(c.req.header('Authorization'));
      const dropHash = c.req.header('X-Drop-Hash') ?? '';
      if (!token || !CIRCLE_RE.test(circle) || !HASH_RE.test(dropHash)) return c.json({ error: 'A new circle needs a bearer token and a drop hash.' }, 400);
      await store.createCircle(circle, await sha256Hex(token), dropHash);
    }
    return c.json({ cursor: await store.append(circle, body, now()) }, 201);
  });

  /** Write-only delivery for a courier. The drop token cannot read, list or erase. */
  app.post('/v1/circles/:circle/drop', async (c) => {
    const circle = c.req.param('circle');
    const token = bearerOf(c.req.header('Authorization'));
    const known = CIRCLE_RE.test(circle) ? await store.getCircle(circle) : null;
    if (!known || !token || !timingSafeEqual(known.dropHash, await sha256Hex(token))) return c.json({ error: 'Not allowed.' }, 401);
    const body = await c.req.text();
    const bad = validEnvelope(body, circle);
    if (bad) return c.json({ error: bad }, bad.includes('large') ? 413 : 400);
    return c.json({ cursor: await store.append(circle, body, now()) }, 201);
  });

  app.get('/v1/circles/:circle/envelopes', async (c) => {
    const circle = c.req.param('circle');
    if ((await member(circle, c.req.header('Authorization'))) !== 'ok') return c.json({ error: 'Not allowed.' }, 401);
    const after = Number(c.req.query('after') ?? '0');
    const limit = Math.min(MAX_PAGE, Number(c.req.query('limit') ?? MAX_PAGE));
    return c.json({ envelopes: await store.after(circle, Number.isFinite(after) ? after : 0, limit) });
  });

  app.delete('/v1/circles/:circle', async (c) => {
    const circle = c.req.param('circle');
    if ((await member(circle, c.req.header('Authorization'))) !== 'ok') return c.json({ error: 'Not allowed.' }, 401);
    await store.erase(circle);
    return c.body(null, 204);
  });

  return app;
}

/** In-memory store for tests and local runs. */
export function memoryStore(): Store {
  const circles = new Map<string, { bearerHash: string; dropHash: string }>();
  const rows = new Map<string, Array<{ cursor: number; envelope: string }>>();
  let next = 1;
  return {
    async getCircle(c) {
      return circles.get(c) ?? null;
    },
    async createCircle(c, b, d) {
      circles.set(c, { bearerHash: b, dropHash: d });
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
      circles.delete(c);
      rows.delete(c);
    },
  };
}
