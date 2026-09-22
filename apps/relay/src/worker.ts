import { createApp, type Store } from './app';

interface Env {
  DB: {
    prepare(sql: string): {
      bind(...v: unknown[]): { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
    };
  };
}

/** Cloudflare D1 store. Schema: see migrations/0001_init.sql. Deploy needs a Cloudflare account. */
function d1(env: Env): Store {
  return {
    async getCircle(c) {
      const r = await env.DB.prepare('SELECT bearer_hash, drop_hash FROM circles WHERE id = ?').bind(c).first<{ bearer_hash: string; drop_hash: string }>();
      return r ? { bearerHash: r.bearer_hash, dropHash: r.drop_hash } : null;
    },
    async createCircle(c, b, d) {
      await env.DB.prepare('INSERT INTO circles (id, bearer_hash, drop_hash) VALUES (?, ?, ?)').bind(c, b, d).run();
    },
    async append(c, e, at) {
      await env.DB.prepare('INSERT INTO envelopes (circle, envelope, received_at) VALUES (?, ?, ?)').bind(c, e, at).run();
      const r = await env.DB.prepare('SELECT MAX(cursor) AS cursor FROM envelopes WHERE circle = ?').bind(c).first<{ cursor: number }>();
      return r?.cursor ?? 0;
    },
    async after(c, cursor, limit) {
      const r = await env.DB.prepare('SELECT cursor, envelope FROM envelopes WHERE circle = ? AND cursor > ? ORDER BY cursor LIMIT ?').bind(c, cursor, limit).all<{ cursor: number; envelope: string }>();
      return r.results;
    },
    async erase(c) {
      await env.DB.prepare('DELETE FROM envelopes WHERE circle = ?').bind(c).run();
      await env.DB.prepare('DELETE FROM circles WHERE id = ?').bind(c).run();
    },
  };
}

export default {
  fetch(req: Request, env: Env): Promise<Response> | Response {
    return createApp(d1(env)).fetch(req);
  },
};
