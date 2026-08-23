const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 5;
const MAX_CONCURRENT_REQUESTS = 2;

type CallerState = {
  windowStartedAt: number;
  requestCount: number;
  activeCount: number;
  lastSeenAt: number;
};

const callers = new Map<string, CallerState>();

export type RequestSlot =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: 'rate_limit' | 'concurrency'; retryAfter: number };

export function acquireRequestSlot(callerId: string): RequestSlot {
  const now = Date.now();

  for (const [id, state] of callers) {
    if (state.activeCount === 0 && now - state.lastSeenAt > WINDOW_MS * 2) {
      callers.delete(id);
    }
  }

  const state = callers.get(callerId) ?? {
    windowStartedAt: now,
    requestCount: 0,
    activeCount: 0,
    lastSeenAt: now,
  };

  if (now - state.windowStartedAt >= WINDOW_MS) {
    state.windowStartedAt = now;
    state.requestCount = 0;
  }

  state.lastSeenAt = now;
  callers.set(callerId, state);

  if (state.requestCount >= REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      reason: 'rate_limit',
      retryAfter: Math.max(1, Math.ceil((state.windowStartedAt + WINDOW_MS - now) / 1000)),
    };
  }

  if (state.activeCount >= MAX_CONCURRENT_REQUESTS) {
    return { allowed: false, reason: 'concurrency', retryAfter: 2 };
  }

  state.requestCount += 1;
  state.activeCount += 1;
  let released = false;

  return {
    allowed: true,
    release() {
      if (released) return;
      released = true;
      state.activeCount = Math.max(0, state.activeCount - 1);
      state.lastSeenAt = Date.now();
    },
  };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  if (fetchSite === 'cross-site') return false;
  if (!origin) return true;

  return origin === new URL(request.url).origin;
}

export function clientAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}
