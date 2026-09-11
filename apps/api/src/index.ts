import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  config, pool, q, verifyToken, subscribe, unsubscribe,
  subscriberCount, type StaffToken,
} from './core.js';
import menuRoutes from './routes/menu.js';
import floorRoutes from './routes/floor.js';
import orderRoutes from './routes/orders.js';
import billingRoutes from './routes/billing.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';

declare module 'fastify' {
  interface FastifyRequest {
    staff: StaffToken | null;
  }
}

const app = Fastify({
  logger: {
    level: 'info',
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  },
  // The tablets sit behind the restaurant's own router; trust its headers
  // so the audit log records the device address rather than the gateway.
  trustProxy: true,
});

// Runs on the restaurant LAN, so any device on that network may call in.
// Tighten this to the tablet subnet when the pilot hardware is fixed.
await app.register(cors, { origin: true, credentials: true });
await app.register(websocket);

/** Attaches the signed-in staff member, when a token is presented. */
app.addHook('onRequest', async (req) => {
  const header = req.headers.authorization;
  req.staff = verifyToken(header?.startsWith('Bearer ') ? header.slice(7) : undefined);
});

/**
 * Routes that change money or the kitchen queue require a signed-in
 * staff member. Customer tablets are deliberately exempt: guests order
 * without logging in, which is the whole point of table-linked ordering.
 */
const STAFF_ONLY: Array<{ method: string; path: RegExp }> = [
  { method: 'POST',   path: /^\/api\/bills\/[^/]+\/finalize$/ },
  { method: 'POST',   path: /^\/api\/reports\/closeout$/ },
  { method: 'GET',    path: /^\/api\/reports\/audit$/ },
  { method: 'PATCH',  path: /^\/api\/menu\/\d+\/availability$/ },
];

app.addHook('preHandler', async (req, reply) => {
  const needsStaff = STAFF_ONLY.some(
    (rule) => rule.method === req.method && rule.path.test(req.url.split('?')[0] ?? ''),
  );
  if (needsStaff && !req.staff) {
    return reply.code(401).send({ error: 'staff_authentication_required' });
  }
});

app.setErrorHandler((err, req, reply) => {
  // Validation failures are the client's problem; anything else is ours.
  if ((err as any).name === 'ZodError') {
    return reply.code(400).send({ error: 'invalid_request', detail: (err as any).issues });
  }
  req.log.error({ err }, 'request failed');
  return reply.code(500).send({ error: 'internal_error' });
});

await app.register(menuRoutes);
await app.register(floorRoutes);
await app.register(orderRoutes);
await app.register(billingRoutes);
await app.register(authRoutes);
await app.register(reportRoutes);

/**
 * Real-time channel. Every client subscribes here and receives order,
 * table, waiter-call and billing events. Kept on the LAN so the core
 * loop never depends on an external service.
 */
app.register(async (instance) => {
  instance.get('/ws', { websocket: true }, (socket) => {
    const id = subscribe((data) => socket.send(data));
    socket.send(JSON.stringify({ type: 'hello', subscriberId: id, at: new Date().toISOString() }));

    const keepAlive = setInterval(() => {
      try { socket.ping(); } catch { /* closing */ }
    }, 25_000);

    socket.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe(id);
    });
    socket.on('error', () => {
      clearInterval(keepAlive);
      unsubscribe(id);
    });
  });
});

app.get('/api/health', async () => {
  const started = Date.now();
  const [row] = await q<{ now: Date }>('select now()');
  return {
    status: 'ok',
    database: { connected: true, latencyMs: Date.now() - started, now: row?.now },
    realtime: { subscribers: subscriberCount() },
    uptimeSeconds: Math.round(process.uptime()),
  };
});

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, closing`);
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
