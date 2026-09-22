import { serve } from '@hono/node-server';
import { createApp, memoryStore } from './app';

/** Local run with an in-memory store, used by the browser tests. Data is lost when the process stops. */
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp(memoryStore()).fetch, port });
console.log(`relay listening on http://localhost:${port}`);
