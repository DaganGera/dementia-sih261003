import { createApp, type Store } from './app';

interface Env {
  DB: {
    prepare(sql: string): {
      bind(...v: unknown[]): { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
    };
  };
}

/** Cloudflare D1 store. Schema: see migrations/0001_init.sql. Deploy needs a Cloudflare account (human task H-08). */
function d1(env: Env): Store {
  return {
    async getCircleHash(c) {
      const r = await env.DB.prepare('SELECT bearer_hash FROM circles WHERE id = ?').bind(c).first<{ bearer_hash: string }>();
      return r?.bearer_hash ?? null;
    },
    async createCircle(c, h) {
      await env.DB.prepare('INSERT INTO circles (id, bearer_hash) VALUES (?, ?)').bind(c, h).run();
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
