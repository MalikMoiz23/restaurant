/**
 * Client state that outlives a single screen: the staff session and the
 * guest's unsent cart. Everything else is server state and is fetched.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, storeToken, storedToken, type Staff, type MenuItem } from './lib/api';

// ---------------------------------------------------------------------
// Staff session
// ---------------------------------------------------------------------

type AuthState = {
  staff: Staff | null;
  signingIn: boolean;
  error: string | null;
  retryAfter: number;
  signIn: (pin: string) => Promise<boolean>;
  signOut: () => void;
  restore: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  staff: null,
  signingIn: false,
  error: null,
  retryAfter: 0,

  async signIn(pin) {
    set({ signingIn: true, error: null, retryAfter: 0 });
    try {
      const { token, staff } = await api.signIn(pin);
      storeToken(token);
      set({ staff, signingIn: false });
      return true;
    } catch (err: any) {
      set({
        signingIn: false,
        error: err?.code ?? 'invalid_pin',
        retryAfter: err?.detail?.retryAfter ?? 0,
      });
      return false;
    }
  },

  signOut() {
    storeToken(null);
    set({ staff: null, error: null });
  },

  /** Reuses a token from a previous shift if it has not expired. */
  async restore() {
    if (!storedToken()) return;
    try {
      const { staff } = await api.me();
      set({ staff });
    } catch {
      storeToken(null);
    }
  },
}));

// ---------------------------------------------------------------------
// Cart — what the guest has chosen but not yet sent to the kitchen
// ---------------------------------------------------------------------

export type CartLine = {
  menuItemId: number;
  name: string;
  glyph: string;
  sku: string;
  unitPriceCents: number;
  vatRate: number;
  qty: number;
  note: string;
  seatNo: number | null;
  prepMinutes: number;
};

type CartState = {
  /** Keyed by table so two tablets on one device never share a cart. */
  tableNumber: number | null;
  lines: CartLine[];
  orderNote: string;
  setTable: (n: number) => void;
  add: (item: MenuItem, qty: number, note: string, seatNo: number | null) => void;
  setQty: (index: number, qty: number) => void;
  remove: (index: number) => void;
  setOrderNote: (note: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      tableNumber: null,
      lines: [],
      orderNote: '',

      setTable(n) {
        // Switching tables must never carry a previous table's choices.
        if (get().tableNumber !== n) set({ tableNumber: n, lines: [], orderNote: '' });
      },

      add(item, qty, note, seatNo) {
        set((state) => {
          // Identical line (same item, same note, same seat) merges
          // rather than stacking up as duplicate rows.
          const index = state.lines.findIndex(
            (l) => l.menuItemId === item.id && l.note === note && l.seatNo === seatNo,
          );
          if (index >= 0) {
            const lines = [...state.lines];
            lines[index] = { ...lines[index]!, qty: lines[index]!.qty + qty };
            return { lines };
          }
          return {
            lines: [
              ...state.lines,
              {
                menuItemId: item.id,
                name: item.name,
                glyph: item.glyph,
                sku: item.sku,
                unitPriceCents: item.price_cents,
                vatRate: item.vat_rate,
                qty,
                note,
                seatNo,
                prepMinutes: item.prep_minutes,
              },
            ],
          };
        });
      },

      setQty(index, qty) {
        set((state) => {
          if (qty <= 0) return { lines: state.lines.filter((_, i) => i !== index) };
          const lines = [...state.lines];
          if (!lines[index]) return {};
          lines[index] = { ...lines[index]!, qty };
          return { lines };
        });
      },

      remove(index) {
        set((state) => ({ lines: state.lines.filter((_, i) => i !== index) }));
      },

      setOrderNote(orderNote) {
        set({ orderNote });
      },

      clear() {
        set({ lines: [], orderNote: '' });
      },
    }),
    {
      name: 'mesa.cart',
      storage: createJSONStorage(() => localStorage),
      // A tablet that reloads mid-order must not lose the guest's picks.
      partialize: (s) => ({ tableNumber: s.tableNumber, lines: s.lines, orderNote: s.orderNote }),
    },
  ),
);

export const cartTotalCents = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);

export const cartCount = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + l.qty, 0);

/** How many of one dish are currently in the cart, across all its lines. */
export const cartQtyFor = (lines: CartLine[], menuItemId: number) =>
  lines.reduce((sum, l) => (l.menuItemId === menuItemId ? sum + l.qty : sum), 0);

/**
 * Preview of the wait, shown before the order is sent.
 *
 * Mirrors estimateMinutes in apps/api/src/core.ts. The server's number
 * is authoritative once the order exists; this only exists so the guest
 * sees a figure while still choosing. Keep the two in step.
 */
export function cartEstimateMinutes(lines: CartLine[]): number {
  if (!lines.length) return 0;
  const slowest = Math.max(...lines.map((l) => l.prepMinutes));
  const plates = lines.reduce((sum, l) => sum + l.qty, 0);
  return slowest + Math.min(15, Math.ceil((plates - 1) * 0.5));
}
