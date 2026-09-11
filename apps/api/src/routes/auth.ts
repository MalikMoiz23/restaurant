import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { q, audit, issueToken, type StaffRole } from '../core.js';

/**
 * PIN attempts are throttled per client. A four-digit PIN is only safe
 * behind a lockout, and the tablets sit on a network staff can reach.
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const attempts = new Map<string, { count: number; first: number }>();

function throttle(key: string): { blocked: boolean; retryAfter: number } {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return { blocked: false, retryAfter: 0 };
  }
  rec.count += 1;
  if (rec.count > MAX_ATTEMPTS) {
    return { blocked: true, retryAfter: Math.ceil((WINDOW_MS - (now - rec.first)) / 1000) };
  }
  return { blocked: false, retryAfter: 0 };
}

export default async function authRoutes(app: FastifyInstance) {
  /**
   * Staff sign-in. The PIN identifies the person: we compare against
   * every active staff hash rather than asking for a username first,
   * which keeps the counter to a single four-tap gesture.
   */
  app.post('/api/auth/pin', async (req, reply) => {
    const { pin } = z.object({ pin: z.string().regex(/^\d{4,8}$/) }).parse(req.body);

    const gate = throttle(req.ip);
    if (gate.blocked) {
      await audit('auth', req.ip, 'throttled', {}, null, req.ip);
      return reply.code(429).send({ error: 'too_many_attempts', retryAfter: gate.retryAfter });
    }

    const staff = await q<{ id: string; name: string; role: StaffRole; pin_hash: string }>(
      `select id, name, role, pin_hash from staff where active order by created_at`,
    );

    // Every candidate is checked so the response time does not reveal
    // how far down the list a matching PIN sits.
    let matched: typeof staff[number] | null = null;
    for (const candidate of staff) {
      const ok = await bcrypt.compare(pin, candidate.pin_hash);
      if (ok && !matched) matched = candidate;
    }

    if (!matched) {
      await audit('auth', req.ip, 'pin_rejected', {}, null, req.ip);
      return reply.code(401).send({ error: 'invalid_pin' });
    }

    attempts.delete(req.ip);
    await audit('auth', matched.id, 'signed_in', { role: matched.role }, matched.id, req.ip);

    return {
      token: issueToken({ id: matched.id, name: matched.name, role: matched.role }),
      staff: { id: matched.id, name: matched.name, role: matched.role },
    };
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.staff) return reply.code(401).send({ error: 'not_signed_in' });
    return { staff: req.staff };
  });

  /** Roster shown on the sign-in screen so staff know whose PIN to enter. */
  app.get('/api/staff', async () =>
    q(`select id, name, role from staff where active order by
         case role when 'manager' then 1 when 'cashier' then 2
                   when 'kitchen' then 3 else 4 end, name`));
}
