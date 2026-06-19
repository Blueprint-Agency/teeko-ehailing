import { io, type Socket } from 'socket.io-client';

declare const process: { env: Record<string, string | undefined> };
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      path: '/ws',
      // Allow polling as a fallback so the connection succeeds even if the
      // WebSocket upgrade fails (e.g. proxy/firewall). Mirrors driver socket config.
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

// Emit auth with retry — Clerk's getToken() can return null immediately after
// sign-in if the session hasn't fully hydrated yet. Retry up to 5 times with a
// 500 ms gap before giving up and disconnecting.
async function emitAuth(s: Socket, getToken: () => Promise<string | null>): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      const token = await getToken();
      if (token) {
        console.log(`[socket:rider] emitting auth (attempt ${i + 1})`);
        s.emit('auth', { token });
        return;
      }
      console.log(`[socket:rider] getToken returned null (attempt ${i + 1}), retrying in 500ms`);
    } catch (e) {
      console.log(`[socket:rider] getToken threw (attempt ${i + 1}): ${e}`);
    }
    await new Promise<void>((r) => setTimeout(r, 500));
  }
  console.log(`[socket:rider] auth failed after 5 attempts — disconnecting`);
  s.disconnect();
}

export function connectSocket(getToken: () => Promise<string | null>): Socket {
  const s = getSocket();
  s.off('connect');
  s.on('connect', () => {
    console.log(`[socket:rider] connected sid=${s.id}`);
    emitAuth(s, getToken);
  });
  s.off('connect_error');
  s.on('connect_error', (err) => console.log(`[socket:rider] connect_error: ${err.message}`));
  s.off('disconnect');
  s.on('disconnect', (reason) => console.log(`[socket:rider] disconnected: ${reason}`));
  s.off('auth.ok');
  s.on('auth.ok', (data: unknown) => console.log(`[socket:rider] auth.ok`, JSON.stringify(data)));
  s.off('auth.error');
  s.on('auth.error', (data: unknown) => console.log(`[socket:rider] auth.error`, JSON.stringify(data)));

  if (!s.connected) {
    console.log(`[socket:rider] calling connect() to ${BASE_URL}`);
    s.connect();
  } else {
    console.log(`[socket:rider] already connected — re-authing`);
    emitAuth(s, getToken);
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
