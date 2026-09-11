/**
 * Populates a service in progress so the floor plan, kitchen screen and
 * reports have something real in them on first open.
 *
 *   node scripts/demo.mjs
 *
 * Requires the API to be running. Safe to re-run: it only adds tables
 * that are currently free.
 */
const BASE = process.env.MESA_API ?? 'http://localhost:3001';

let token = null;

async function call(method, path, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

const { token: issued } = await call('POST', '/api/auth/pin', { pin: '1234' });
token = issued;

const menu = await call('GET', '/api/menu?locale=pt');
const bySku = new Map(menu.items.map((i) => [i.sku, i]));
const pick = (...skus) => skus.map((sku) => bySku.get(sku)).filter(Boolean);

/**
 * Each scene is a table at a different point in service, so every state
 * the floor plan can show is represented.
 */
const scenes = [
  {
    table: 3, guests: 2, locale: 'pt',
    orders: [pick('caldo-verde', 'bacalhau-bras', 'vinho-verde-copo')],
    advance: 'served', then: 'bill',
  },
  {
    table: 6, guests: 4, locale: 'en',
    orders: [pick('azeitonas', 'presunto', 'douro-tinto'), pick('polvo-lagareiro', 'picanha')],
    advance: 'preparing',
  },
  {
    table: 8, guests: 6, locale: 'pt',
    orders: [pick('sardinhas', 'francesinha', 'superbock', 'sagres')],
    advance: 'ready',
  },
  {
    table: 14, guests: 2, locale: 'fr',
    orders: [pick('pastel-nata', 'galao', 'cafe')],
    advance: 'received',
  },
  {
    table: 17, guests: 3, locale: 'es',
    orders: [pick('arroz-marisco', 'sangria')],
    advance: 'preparing',
  },
  {
    table: 19, guests: 5, locale: 'pt',
    orders: [pick('alheira', 'cozido', 'leitao', 'alentejo-tinto'), pick('arroz-doce', 'pudim-abade')],
    advance: 'served',
  },
  {
    table: 25, guests: 8, locale: 'pt',
    orders: [pick('queijo-serra', 'ameijoas', 'robalo', 'bacalhau-lagareiro', 'douro-tinto')],
    advance: 'preparing',
  },
];

let opened = 0;
let skipped = 0;

for (const scene of scenes) {
  const existing = await fetch(`${BASE}/api/sessions/by-table/${scene.table}`);
  if (existing.ok) {
    skipped++;
    continue;
  }

  const { sessionId } = await call('POST', '/api/sessions', {
    tableNumber: scene.table,
    guestCount: scene.guests,
    locale: scene.locale,
  });

  for (const [index, items] of scene.orders.entries()) {
    const order = await call('POST', '/api/orders', {
      sessionId,
      note: index === 0 && scene.guests > 4 ? 'Mesa grande — servir em conjunto' : '',
      items: items.map((item, i) => ({
        menuItemId: item.id,
        qty: item.sku === 'pastel-nata' ? 2 : 1,
        note: '',
        seatNo: scene.guests > 1 ? (i % scene.guests) + 1 : null,
      })),
    });

    // Only the first order is advanced; a later reorder stays fresh on
    // the kitchen screen, which is what real service looks like.
    if (index === 0) {
      const path = ['preparing', 'ready', 'served'];
      const stop = path.indexOf(scene.advance);
      for (let step = 0; step <= stop; step++) {
        await call('PATCH', `/api/orders/${order.id}/status`, { status: path[step] });
      }
    }
  }

  if (scene.then === 'bill') {
    await call('POST', '/api/waiter-calls', { tableNumber: scene.table, reason: 'bill' });
  }

  opened++;
}

// A couple of closed bills so today's figures and the calendar are not
// starting from zero.
for (const table of [21, 22]) {
  const check = await fetch(`${BASE}/api/sessions/by-table/${table}`);
  if (check.ok) continue;

  const { sessionId } = await call('POST', '/api/sessions', {
    tableNumber: table, guestCount: 1, locale: 'pt',
  });
  const items = pick('bifana', 'imperial', 'cafe', 'pastel-nata').length
    ? pick('bifana', 'cafe', 'pastel-nata')
    : [];
  await call('POST', '/api/orders', {
    sessionId,
    items: items.map((item) => ({ menuItemId: item.id, qty: 1, note: '', seatNo: null })),
  });
  const bill = await call('GET', `/api/bills/by-table/${table}`);
  await call('POST', `/api/bills/${bill.bill.id}/finalize`, {
    paymentMethod: table === 21 ? 'multibanco' : 'cash',
    nif: null,
  });
}

const tables = await call('GET', '/api/tables');
const live = tables.filter((t) => t.session_id);
const today = await call('GET', '/api/reports/today');

console.log(`opened ${opened} tables, skipped ${skipped} already in service`);
console.log(`${live.length} tables now live, running total ${(live.reduce((s, t) => s + t.gross_cents, 0) / 100).toFixed(2)} EUR`);
console.log(`today closed: ${today.summary.bills_count} bills, ${(today.summary.gross_cents / 100).toFixed(2)} EUR`);
