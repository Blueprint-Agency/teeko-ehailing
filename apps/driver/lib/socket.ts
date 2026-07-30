import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

// Listeners are bound exactly once against the singleton. The `connect` handler
// reads the token through this module-level getter rather than a closure, so a
// later connectSocket() call updates the token source without re-binding (and
// without stacking duplicate listeners on reconnect).
let listenersBound = false;
let tokenGetter: (() => Promise<string | null>) | null = null;

// Auth failure backoff. The server calls socket.disconnect() when a token fails
// to verify or maps to no user row; with reconnection:Infinity + 1s delay that
// turns a bad token into ~1 connect/auth/disconnect cycle per second, forever.
// So we disarm socket.io's own reconnection on auth.error and retry ourselves on
// a widening schedule, giving Clerk time to mint a fresh token. After the last
// delay we stop entirely until something explicitly re-arms us — a sign-in or an
// app foreground (see resumeSocket).
const AUTH_RETRY_DELAYS_MS = [5_000, 15_000, 60_000];
let authRetryIndex = 0;
let authRetryTimer: ReturnType<typeof setTimeout> | null = null;

// Wall-clock of the last successful connect, for the disconnect log below.
let connectedAt: number | null = null;

function clearAuthRetry(): void {
  if (authRetryTimer) {
    clearTimeout(authRetryTimer);
    authRetryTimer = null;
  }
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      upgrade: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
  }
  return socket;
}

function bindListeners(s: Socket): void {
  if (listenersBound) return;
  listenersBound = true;

  s.on('connect', () => {
    connectedAt = Date.now();
    console.log(`[socket] connect transport=${s.io.engine.transport.name}`);
    tokenGetter?.().then((token) => {
      if (token) {
        s.emit('auth', { token });
      } else {
        s.disconnect();
      }
    });
  });

  s.on('auth.ok', () => {
    // A good handshake clears the backoff so the next failure starts from the
    // short delay again rather than the long one.
    authRetryIndex = 0;
    clearAuthRetry();
  });

  s.on('auth.error', (data: unknown) => {
    console.warn('[socket] auth.error', JSON.stringify(data));
    s.io.opts.reconnection = false;
    clearAuthRetry();

    const delay = AUTH_RETRY_DELAYS_MS[authRetryIndex];
    if (delay === undefined) {
      console.warn('[socket] auth retries exhausted — staying offline until re-armed');
      return;
    }
    authRetryIndex += 1;
    authRetryTimer = setTimeout(() => {
      authRetryTimer = null;
      if (tokenGetter) connectSocket(tokenGetter);
    }, delay);
  });

  s.on('connect_error', (err) => console.warn(`[socket] connect_error: ${err.message}`));

  // Mirror of the server's disconnect log. 'io client disconnect' here means
  // OUR code called disconnect(); anything else means the socket died beneath
  // us. Pair the two logs by elapsed time to tell an app bug from a network one.
  s.on('disconnect', (reason) => {
    const livedMs = connectedAt ? Date.now() - connectedAt : -1;
    connectedAt = null;
    console.warn(`[socket] disconnect reason="${reason}" livedMs=${livedMs}`);
  });
}

export function connectSocket(getToken: () => Promise<string | null>): Socket {
  const s = getSocket();
  tokenGetter = getToken;
  bindListeners(s);

  // Re-arm reconnection: a previous auth.error may have disabled it.
  s.io.opts.reconnection = true;

  if (s.connected) {
    getToken().then((token) => {
      if (token) s.emit('auth', { token });
    });
  } else {
    s.connect();
  }
  return s;
}

/**
 * Called when the app returns to the foreground. Android Doze / iOS suspension
 * freezes the JS loop, so the server's ping times out and drops the socket while
 * the client still believes it is connected. On resume we reconnect if the
 * transport is actually down, and re-send `auth` if it survived — the server
 * keeps no session across a socket, so an unauthenticated socket is invisible to
 * dispatch even though it is technically connected.
 */
export function resumeSocket(): void {
  if (!socket || !tokenGetter) return;
  clearAuthRetry();
  authRetryIndex = 0;
  connectSocket(tokenGetter);
}

export function disconnectSocket(): void {
  clearAuthRetry();
  authRetryIndex = 0;
  socket?.disconnect();
}
