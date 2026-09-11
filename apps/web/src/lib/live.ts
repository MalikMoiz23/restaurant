/**
 * Real-time layer.
 *
 * One WebSocket per device, shared by every screen through a tiny
 * subscriber registry. It reconnects on its own with backoff, because a
 * restaurant's Wi-Fi will drop and nobody is going to reload a tablet
 * mid-service.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

export type LiveEvent =
  | { type: 'hello'; subscriberId: string; at: string }
  | { type: 'order.created'; orderId: string; tableNumber: number; sessionId: string; at: string }
  | { type: 'order.status'; orderId: string; status: string; tableNumber: number; at: string }
  | { type: 'table.status'; tableId: number; tableNumber: number; status: string; at: string }
  | { type: 'session.opened'; sessionId: string; tableNumber: number; at: string }
  | { type: 'session.closed'; sessionId: string; tableNumber: number; at: string }
  | { type: 'waiter.call'; callId: string; tableNumber: number; reason: string; at: string }
  | { type: 'waiter.ack'; callId: string; tableNumber: number; at: string }
  | { type: 'bill.finalized'; billId: string; tableNumber: number; totalCents: number; at: string }
  | { type: 'closeout.done'; businessDate: string; grossCents: number; at: string }
  | { type: 'menu.updated'; itemId: number; available: boolean; at: string };

export type ConnectionState = 'connecting' | 'online' | 'offline';

type Listener = (event: LiveEvent) => void;

const listeners = new Set<Listener>();
const stateListeners = new Set<(s: ConnectionState) => void>();

let socket: WebSocket | null = null;
let state: ConnectionState = 'connecting';
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function setState(next: ConnectionState) {
  if (state === next) return;
  state = next;
  for (const l of stateListeners) l(next);
}

function socketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  setState(attempt === 0 ? 'connecting' : state);

  try {
    socket = new WebSocket(socketUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    attempt = 0;
    setState('online');
  };

  socket.onmessage = (message) => {
    let event: LiveEvent;
    try {
      event = JSON.parse(message.data as string);
    } catch {
      return;
    }
    for (const l of listeners) {
      try {
        l(event);
      } catch {
        /* a broken listener must not take down the socket */
      }
    }
  };

  socket.onclose = () => {
    setState('offline');
    scheduleReconnect();
  };

  socket.onerror = () => {
    // onclose always follows, which is where the retry is scheduled.
    setState('offline');
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  // 0.5s, 1s, 2s, 4s ... capped at 15s. Fast enough that a brief blip is
  // invisible, slow enough not to hammer a struggling server.
  const delay = Math.min(15_000, 500 * 2 ** attempt);
  attempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function start() {
  if (started) return;
  started = true;
  connect();

  // A tablet that has been asleep in an apron pocket comes back with a
  // dead socket that reports itself open. Re-check whenever it wakes.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket?.readyState !== WebSocket.OPEN) {
      attempt = 0;
      connect();
    }
  });
  window.addEventListener('online', () => {
    attempt = 0;
    connect();
  });
  window.addEventListener('offline', () => setState('offline'));
}

/** Subscribes to live events. Pass the event types you care about. */
export function useLiveEvents(
  types: Array<LiveEvent['type']> | 'all',
  handler: Listener,
) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    start();
    const listener: Listener = (event) => {
      if (types === 'all' || types.includes(event.type)) ref.current(event);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
    // `types` is a literal array at every call site; joining keeps the
    // effect from re-subscribing on each render.
  }, [Array.isArray(types) ? types.join(',') : 'all']);
}

export function useConnection(): ConnectionState {
  const [current, setCurrent] = useState<ConnectionState>(state);
  useEffect(() => {
    start();
    setCurrent(state);
    stateListeners.add(setCurrent);
    return () => {
      stateListeners.delete(setCurrent);
    };
  }, []);
  return current;
}

// ---------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------

export type Query<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** True while refetching with data already on screen - no spinner. */
  refreshing: boolean;
  reload: () => void;
};

/**
 * Fetch-and-refresh hook. Deliberately small: the interesting part of
 * this system is the live channel above, which pushes rather than polls.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { pollMs?: number; enabled?: boolean } = {},
): Query<T> {
  const { pollMs, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasData = useRef(false);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    if (hasData.current) setRefreshing(true);
    else setLoading(true);

    fetcherRef.current()
      .then((result) => {
        if (cancelled) return;
        hasData.current = true;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [...deps, nonce, enabled]);

  useEffect(() => {
    if (!pollMs || !enabled) return;
    const id = setInterval(reload, pollMs);
    return () => clearInterval(id);
  }, [pollMs, enabled, reload]);

  return { data, error, loading, refreshing, reload };
}
