import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const syncEvents: any[] = [];
const sseClients: any[] = [];

const crossDeviceSyncPlugin = (): Plugin => ({
  name: 'cross-device-sync-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // 1. CORS Preflight
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.statusCode = 204;
        res.end();
        return;
      }

      // 2. Broadcast POST Event Endpoint (Mobile -> Server)
      if (req.url === '/api/sync/events' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            syncEvents.unshift(payload);
            if (syncEvents.length > 50) syncEvents.pop();

            // Broadcast instantly to all active SSE clients (Laptop)
            sseClients.forEach(clientRes => {
              try {
                clientRes.write(`data: ${JSON.stringify(payload)}\n\n`);
              } catch (e) {
                // client closed
              }
            });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, broadcastCount: sseClients.length }));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
          }
        });
        return;
      }

      // 3. Server-Sent Events (SSE) Stream Endpoint (Laptop Receiver)
      if (req.url === '/api/sync/stream' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.write('retry: 1500\n\n');

        sseClients.push(res);

        req.on('close', () => {
          const idx = sseClients.indexOf(res);
          if (idx !== -1) sseClients.splice(idx, 1);
        });
        return;
      }

      // 4. Polling Fallback Endpoint
      if (req.url?.startsWith('/api/sync/poll') && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ events: syncEvents }));
        return;
      }

      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crossDeviceSyncPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
