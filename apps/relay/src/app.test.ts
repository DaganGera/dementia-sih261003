import { describe, expect, it } from 'vitest';
import { createApp, memoryStore } from './app';

const circle = 'c-0a1b2c3d4e5f';
const env = (c = circle, extra: Record<string, unknown> = {}) => JSON.stringify({ v: 1, circle: c, from: 'dev', vector: {}, nonce: 'n', ciphertext: 'AAAA', sig: 's', ...extra });
const call = (app: ReturnType<typeof createApp>, path: string, init?: RequestInit) => app.request(path, init);
const post = (app: ReturnType<typeof createApp>, token: string, body = env()) =>
  call(app, `/v1/circles/${circle}/envelopes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });

describe('relay', () => {
  it('creates a circle on first write and returns envelopes in order after a cursor', async () => {
    const app = createApp(memoryStore());
    expect((await post(app, 'tok-1')).status).toBe(201);
    expect((await post(app, 'tok-1', env(circle, { from: 'dev2' }))).status).toBe(201);
    const r = await call(app, `/v1/circles/${circle}/envelopes?after=0`, { headers: { Authorization: 'Bearer tok-1' } });
    const { envelopes } = (await r.json()) as { envelopes: Array<{ cursor: number }> };
    expect(envelopes.map((e) => e.cursor)).toEqual([1, 2]);
    const r2 = await call(app, `/v1/circles/${circle}/envelopes?after=1`, { headers: { Authorization: 'Bearer tok-1' } });
    expect(((await r2.json()) as { envelopes: unknown[] }).envelopes).toHaveLength(1);
  });

  it('rejects a wrong bearer, a missing bearer and a circle that does not exist', async () => {
    const app = createApp(memoryStore());
    await post(app, 'tok-1');
    expect((await post(app, 'tok-2')).status).toBe(401);
    expect((await call(app, `/v1/circles/${circle}/envelopes`)).status).toBe(401);
    expect((await call(app, '/v1/circles/c-ffffffffffff/envelopes', { headers: { Authorization: 'Bearer tok-1' } })).status).toBe(401);
    expect((await call(app, '/v1/circles/not-a-circle/envelopes', { headers: { Authorization: 'Bearer tok-1' } })).status).toBe(401);
  });

  it('refuses envelopes that do not match the circle, are not JSON or are too large', async () => {
    const app = createApp(memoryStore());
    expect((await post(app, 't', env('c-999999999999'))).status).toBe(400);
    expect((await post(app, 't', 'not json')).status).toBe(400);
    expect((await post(app, 't', env(circle, { ciphertext: 'x'.repeat(300_000) }))).status).toBe(413);
  });

  it('stores only what it was given: the relay never sees plaintext or the bearer', async () => {
    const store = memoryStore();
    const app = createApp(store);
    await post(app, 'secret-bearer-token');
    const hash = await store.getCircleHash(circle);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('secret');
    const stored = (await store.after(circle, 0, 10))[0]!.envelope;
    expect(stored).not.toContain('secret-bearer-token');
  });

  it('erases a circle for the holder of the bearer only', async () => {
    const app = createApp(memoryStore());
    await post(app, 'tok-1');
    expect((await call(app, `/v1/circles/${circle}`, { method: 'DELETE', headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    expect((await call(app, `/v1/circles/${circle}`, { method: 'DELETE', headers: { Authorization: 'Bearer tok-1' } })).status).toBe(204);
    expect((await call(app, `/v1/circles/${circle}/envelopes`, { headers: { Authorization: 'Bearer tok-1' } })).status).toBe(401);
  });

  it('sets no-store on every response', async () => {
    const app = createApp(memoryStore());
    expect((await call(app, '/v1/health')).headers.get('Cache-Control')).toBe('no-store');
  });
});
