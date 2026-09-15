/**
 * The single seam between the interface and the backend.
 *
 * Every screen calls this module and nothing else, so the transport can
 * change - LAN server today, a different host tomorrow - without any
 * screen being touched.
 */
import type { Locale } from './format';

export type Station = 'cozinha' | 'grelha' | 'bar' | 'pastelaria';
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type TableStatus =
  | 'free' | 'occupied' | 'ordering' | 'eating' | 'awaiting_bill' | 'needs_cleaning';
export type PaymentMethod = 'cash' | 'mbway' | 'multibanco' | 'card';
export type StaffRole = 'waiter' | 'kitchen' | 'cashier' | 'manager';
export type CallReason = 'help' | 'water' | 'bill' | 'cleaning' | 'cutlery';

export type MenuCategory = {
  id: number;
  code: string;
  icon: string;
  sort_order: number;
  name: string;
};

export type MenuItem = {
  id: number;
  category_id: number;
  sku: string;
  price_cents: number;
  vat_rate: number;
  glyph: string;
  available: boolean;
  is_alcoholic: boolean;
  prep_minutes: number;
  kitchen_station: Station;
  sort_order: number;
  name: string;
  description: string;
  allergens: string[];
  diets: string[];
};

export type TagInfo = { code: string; name: string; icon: string };

export type Menu = {
  locale: Locale;
  categories: MenuCategory[];
  items: MenuItem[];
  allergens: TagInfo[];
  diets: TagInfo[];
};

export type FloorTable = {
  id: number;
  number: number;
  seats: number;
  status: TableStatus;
  grid_x: number;
  grid_y: number;
  updated_at: string;
  zone_code: string;
  zone_name_pt: string;
  zone_name_en: string;
  session_id: string | null;
  opened_at: string | null;
  guest_count: number | null;
  locale: Locale | null;
  gross_cents: number;
  line_count: number;
  active_orders: number;
  open_call: { id: string; reason: CallReason; created_at: string } | null;
};

export type OrderLine = {
  id: string;
  menuItemId: number;
  name: string;
  unitPriceCents: number;
  vatRate: number;
  qty: number;
  note: string;
  seatNo: number | null;
  station: Station;
  glyph: string;
  prepMinutes: number;
};

export type Order = {
  id: string;
  seq: number;
  status: OrderStatus;
  note: string;
  placed_at: string;
  preparing_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  items: OrderLine[];
  /** Heuristic from each dish's prep time - see estimateMinutes in the API. */
  estimated_minutes: number;
  ready_estimate_at: string;
};

export type SessionDetail = {
  session: {
    id: string;
    table_id: number;
    guest_count: number;
    locale: Locale;
    status: 'open' | 'awaiting_bill' | 'closed';
    opened_at: string;
    table_number: number;
    seats: number;
    table_status: TableStatus;
  };
  orders: Order[];
  totals: {
    net_cents: number;
    vat_13_cents: number;
    vat_23_cents: number;
    gross_cents: number;
    line_count: number;
  } | null;
  bill: {
    id: string;
    status: 'open' | 'finalized' | 'void';
    split_mode: string;
    nif: string | null;
    payment_method: PaymentMethod | null;
    invoice_no: string | null;
    atcud: string | null;
    qr_payload: string | null;
    finalized_at: string | null;
    total_cents: number;
  } | null;
  openCall: { id: string; reason: CallReason; created_at: string } | null;
};

export type KdsOrder = {
  id: string;
  seq: number;
  status: OrderStatus;
  note: string;
  placed_at: string;
  preparing_at: string | null;
  ready_at: string | null;
  age_seconds: number;
  table_number: number;
  zone_name: string;
  guest_count: number;
  estimated_minutes: number;
  ready_estimate_at: string;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    note: string;
    station: Station;
    seatNo: number | null;
    glyph: string;
    prepMinutes: number;
  }>;
};

export type BillLine = {
  id: string;
  name_snapshot: string;
  unit_price_cents: number;
  vat_rate: number;
  qty: number;
  seat_no: number | null;
  note: string;
  order_seq: number;
  glyph: string;
};

export type BillTotals = {
  subtotal_cents: number;
  vat_13_cents: number;
  vat_23_cents: number;
  total_cents: number;
};

export type BillSplit = {
  id: string;
  label: string;
  total_cents: number;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  item_ids: string[];
};

export type BillView = {
  session: {
    session_id: string;
    guest_count: number;
    opened_at: string;
    session_status: string;
    table_id: number;
    table_number: number;
    zone_name: string;
  };
  bill: {
    id: string;
    status: 'open' | 'finalized' | 'void';
    split_mode: string;
    nif: string | null;
    payment_method: PaymentMethod | null;
    discount_cents: number;
    invoice_no: string | null;
    atcud: string | null;
    qr_payload: string | null;
    finalized_at: string | null;
  } | null;
  lines: BillLine[];
  totals: BillTotals;
  splits: BillSplit[];
};

export type Receipt = {
  tableNumber: number;
  guestCount: number;
  lines: BillLine[];
  totals: BillTotals & { discount_cents: number; payable_cents: number };
  paymentMethod: PaymentMethod;
  nif: string | null;
  invoiceNo: string;
  atcud: string;
  qrPayload: string;
  certified: boolean;
  provider: string;
  issuedAt: string;
};

export type SalesDay = {
  business_date: string;
  gross_cents: number;
  vat_cents: number;
  net_cents: number;
  bills_count: number;
  covers_count: number;
  by_payment: Partial<Record<PaymentMethod, number>>;
  is_closed: boolean;
};

export type SalesReport = {
  from: string;
  to: string;
  days: SalesDay[];
  totals: {
    gross_cents: number; vat_cents: number; net_cents: number;
    bills_count: number; covers_count: number;
  };
  averages: { per_day_cents: number; per_cover_cents: number; per_bill_cents: number };
  trading_days: number;
};

export type TodayReport = {
  summary: {
    gross_cents: number; vat_cents: number; net_cents: number;
    vat_13_cents: number; vat_23_cents: number; bills_count: number;
  };
  byPayment: Array<{ method: PaymentMethod; total_cents: number; count: number }>;
  topItems: Array<{ name: string; qty: number; revenue_cents: number; glyph: string }>;
  openTables: { count: number; gross_cents: number };
  closeout: { business_date: string; closed_at: string } | null;
};

export type Staff = { id: string; name: string; role: StaffRole };

export type AuditEntry = {
  id: number; at: string; entity: string; entity_id: string;
  action: string; detail: Record<string, unknown>; ip: string | null;
  staff_name: string | null;
};

// ---------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: unknown,
  ) {
    super(`${code} (${status})`);
    this.name = 'ApiError';
  }
}

const TOKEN_KEY = 'mesa.token';

export function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing - the session simply will not persist */
  }
}

// `body` is widened to unknown and JSON-encoded below, so RequestInit's
// own BodyInit typing has to be dropped rather than intersected.
type Request = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, init: Request = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = storedToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.body);
  }

  const res = await fetch(path, { ...init, headers, body });

  if (!res.ok) {
    let code = `http_${res.status}`;
    let detail: unknown;
    try {
      const payload = await res.json();
      code = payload.error ?? code;
      detail = payload.detail ?? payload;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  menu: (locale: Locale) => request<Menu>(`/api/menu?locale=${locale}`),
  setAvailability: (id: number, available: boolean) =>
    request<{ id: number; available: boolean }>(
      `/api/menu/${id}/availability`, { method: 'PATCH', body: { available } },
    ),

  tables: () => request<FloorTable[]>('/api/tables'),
  setTableStatus: (id: number, status: TableStatus) =>
    request<{ id: number; number: number; status: TableStatus }>(
      `/api/tables/${id}/status`, { method: 'PATCH', body: { status } },
    ),

  openSession: (tableNumber: number, guestCount: number, locale: Locale) =>
    request<{ sessionId: string; tableNumber: number; reattached: boolean }>(
      '/api/sessions', { method: 'POST', body: { tableNumber, guestCount, locale } },
    ),
  sessionByTable: (tableNumber: number) =>
    request<SessionDetail>(`/api/sessions/by-table/${tableNumber}`),
  session: (id: string) => request<SessionDetail>(`/api/sessions/${id}`),

  placeOrder: (
    sessionId: string,
    items: Array<{ menuItemId: number; qty: number; note?: string; seatNo?: number | null }>,
    note = '',
  ) =>
    request<{
      id: string; seq: number; status: OrderStatus;
      estimatedMinutes: number; readyEstimateAt: string;
    }>(
      '/api/orders',
      {
        method: 'POST',
        body: {
          sessionId, note,
          items: items.map((i) => ({
            menuItemId: i.menuItemId, qty: i.qty,
            note: i.note ?? '', seatNo: i.seatNo ?? null,
          })),
        },
      },
    ),
  kds: (station: Station | 'all' = 'all') =>
    request<KdsOrder[]>(`/api/kds/orders?station=${station}`),
  setOrderStatus: (id: string, status: OrderStatus) =>
    request<{ id: string; status: OrderStatus }>(
      `/api/orders/${id}/status`, { method: 'PATCH', body: { status } },
    ),
  voidLine: (id: string) =>
    request<{ deleted: boolean }>(`/api/order-items/${id}`, { method: 'DELETE' }),

  callWaiter: (tableNumber: number, reason: CallReason) =>
    request<{ id: string; deduplicated: boolean }>(
      '/api/waiter-calls', { method: 'POST', body: { tableNumber, reason } },
    ),
  waiterCalls: () =>
    request<Array<{ id: string; reason: CallReason; created_at: string; table_number: number; zone: string }>>(
      '/api/waiter-calls',
    ),
  ackCall: (id: string) =>
    request<{ id: string }>(`/api/waiter-calls/${id}/ack`, { method: 'PATCH' }),

  billByTable: (tableNumber: number) =>
    request<BillView>(`/api/bills/by-table/${tableNumber}`),
  bill: (id: string) => request<BillView>(`/api/bills/${id}`),
  splitBill: (
    id: string,
    payload:
      | { mode: 'none' }
      | { mode: 'even'; ways: number }
      | { mode: 'by_person' }
      | { mode: 'by_item'; groups: Array<{ label: string; itemIds: string[] }> },
  ) => request<{ mode: string; splits: BillSplit[] }>(
    `/api/bills/${id}/split`, { method: 'POST', body: payload },
  ),
  paySplit: (id: string, method: PaymentMethod) =>
    request<BillSplit>(`/api/bill-splits/${id}/pay`, { method: 'PATCH', body: { method } }),
  finalizeBill: (
    id: string,
    payload: { paymentMethod: PaymentMethod; nif: string | null; discountCents?: number },
  ) => request<{ bill: unknown; receipt: Receipt }>(
    `/api/bills/${id}/finalize`,
    { method: 'POST', body: { ...payload, discountCents: payload.discountCents ?? 0 } },
  ),

  sales: (from: string, to: string) =>
    request<SalesReport>(`/api/reports/sales?from=${from}&to=${to}`),
  today: () => request<TodayReport>('/api/reports/today'),
  closeout: (force = false) =>
    request<{ business_date: string; gross_cents: number; bills_count: number }>(
      '/api/reports/closeout', { method: 'POST', body: { force } },
    ),
  auditTrail: (limit = 60) => request<AuditEntry[]>(`/api/reports/audit?limit=${limit}`),

  signIn: (pin: string) =>
    request<{ token: string; staff: Staff }>('/api/auth/pin', { method: 'POST', body: { pin } }),
  me: () => request<{ staff: Staff }>('/api/auth/me'),
  staff: () => request<Staff[]>('/api/staff'),
};
