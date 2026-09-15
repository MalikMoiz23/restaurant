/**
 * Shared infrastructure: config, database pool, money maths,
 * the WebSocket event bus and the audit trail.
 */
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../../.env') });

export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  host: process.env.API_HOST ?? '0.0.0.0',
  authSecret: process.env.AUTH_SECRET ?? 'dev-only-change-me-in-production',
};

// ---------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------

// pg returns numeric as string to avoid precision loss. Every numeric we
// select is a VAT rate (13.00 / 23.00), so parsing to float is safe here.
pg.types.setTypeParser(1700, (v) => parseFloat(v));

export const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 12,
  idleTimeoutMillis: 30_000,
});

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** Runs a callback inside a transaction, rolling back on any throw. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------
// Money. Prices are IVA-inclusive integer cents, matching the
// Portuguese retail convention of advertising the price a guest pays.
// ---------------------------------------------------------------------

export const VAT_FOOD = 13;
export const VAT_STANDARD = 23;

/** Splits an IVA-inclusive gross amount into its net and tax parts. */
export function splitVat(grossCents: number, ratePercent: number) {
  const net = Math.round(grossCents / (1 + ratePercent / 100));
  return { net, vat: grossCents - net };
}

export type BillLine = {
  gross_cents: number;
  vat_rate: number;
};

/** Aggregates lines into the totals block printed on a Portuguese bill. */
export function billTotals(lines: BillLine[]) {
  let net = 0;
  let vat13 = 0;
  let vat23 = 0;
  let gross = 0;
  for (const line of lines) {
    const s = splitVat(line.gross_cents, line.vat_rate);
    net += s.net;
    gross += line.gross_cents;
    if (line.vat_rate === VAT_STANDARD) vat23 += s.vat;
    else vat13 += s.vat;
  }
  return {
    subtotal_cents: net,
    vat_13_cents: vat13,
    vat_23_cents: vat23,
    total_cents: gross,
  };
}

// ---------------------------------------------------------------------
// Prep-time estimate
// ---------------------------------------------------------------------

/**
 * How long an order should take, in minutes.
 *
 * This is a HEURISTIC, not a measurement. We have no historical cook
 * times yet, so it is derived from each dish's configured prep_minutes:
 * a kitchen works several dishes in parallel, so the slowest dish sets
 * the floor, and each additional plate adds a little on top for the
 * pass. Tuned to under-promise rather than over-promise, because a
 * guest forgives early food and remembers late food.
 *
 * Replace this with a model fitted to real ready_at - placed_at data
 * once the pilot has collected a few weeks of service.
 */
export function estimateMinutes(
  items: Array<{ prepMinutes: number; qty: number }>,
): number {
  if (!items.length) return 0;
  const slowest = Math.max(...items.map((i) => i.prepMinutes));
  const plates = items.reduce((sum, i) => sum + i.qty, 0);
  // Half a minute per extra plate, capped so a large table does not get
  // quoted an absurd number.
  const passOverhead = Math.min(15, Math.ceil((plates - 1) * 0.5));
  return slowest + passOverhead;
}

/**
 * Splits an amount N ways without losing or inventing a cent.
 * The remainder is spread one cent at a time across the first shares.
 */
export function splitEvenly(totalCents: number, ways: number): number[] {
  const base = Math.floor(totalCents / ways);
  const remainder = totalCents - base * ways;
  return Array.from({ length: ways }, (_, i) => base + (i < remainder ? 1 : 0));
}

// ---------------------------------------------------------------------
// Staff session tokens (HMAC, no external dependency)
// ---------------------------------------------------------------------

export type StaffRole = 'waiter' | 'kitchen' | 'cashier' | 'manager';
export type StaffToken = { id: string; name: string; role: StaffRole; exp: number };

function sign(payload: string) {
  return createHmac('sha256', config.authSecret).update(payload).digest('base64url');
}

export function issueToken(staff: { id: string; name: string; role: StaffRole }) {
  const body: StaffToken = {
    ...staff,
    exp: Date.now() + 12 * 60 * 60 * 1000, // one trading day
  };
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): StaffToken | null {
  if (!token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = sign(payload);
  // Constant-time compare; length mismatch alone is not a timing leak.
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString()) as StaffToken;
    return body.exp > Date.now() ? body : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Event bus. On the restaurant LAN this is the real-time transport
// between the tablets, the kitchen screen and the counter.
// ---------------------------------------------------------------------

export type MesaEvent =
  | { type: 'order.created'; orderId: string; tableNumber: number; sessionId: string }
  | { type: 'order.status'; orderId: string; status: string; tableNumber: number }
  | { type: 'table.status'; tableId: number; tableNumber: number; status: string }
  | { type: 'session.opened'; sessionId: string; tableNumber: number }
  | { type: 'session.closed'; sessionId: string; tableNumber: number }
  | { type: 'waiter.call'; callId: string; tableNumber: number; reason: string }
  | { type: 'waiter.ack'; callId: string; tableNumber: number }
  | { type: 'bill.finalized'; billId: string; tableNumber: number; totalCents: number }
  | { type: 'closeout.done'; businessDate: string; grossCents: number }
  | { type: 'menu.updated'; itemId: number; available: boolean };

type Sub = { id: string; send: (data: string) => void };
const subscribers = new Map<string, Sub>();

export function subscribe(send: (data: string) => void): string {
  const id = randomUUID();
  subscribers.set(id, { id, send });
  return id;
}

export function unsubscribe(id: string) {
  subscribers.delete(id);
}

export function broadcast(event: MesaEvent) {
  const frame = JSON.stringify({ ...event, at: new Date().toISOString() });
  for (const sub of subscribers.values()) {
    try {
      sub.send(frame);
    } catch {
      subscribers.delete(sub.id);
    }
  }
}

export const subscriberCount = () => subscribers.size;

// ---------------------------------------------------------------------
// Audit trail. Every order and bill mutation lands here.
// ---------------------------------------------------------------------

export async function audit(
  entity: string,
  entityId: string,
  action: string,
  detail: unknown = {},
  staffId: string | null = null,
  ip: string | null = null,
) {
  await q(
    `insert into audit_log (staff_id, entity, entity_id, action, detail, ip)
     values ($1, $2, $3, $4, $5, $6)`,
    [staffId, entity, entityId, action, JSON.stringify(detail), ip],
  );
}
