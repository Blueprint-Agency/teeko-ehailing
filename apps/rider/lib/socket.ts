import { io, type Socket } from 'socket.io-client';

declare const process: { env: Record<string, string | undefined> };
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      path: '/ws',
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  const s = getSocket();
  // Remove any stale listener so we don't stack handlers on repeated calls.
  s.off('connect');
  // Use persistent 'on' (not 'once') so auth is re-emitted after every
  // socket.io auto-reconnect, keeping the backend session alive between trips.
  s.on('connect', () => s.emit('auth', { token }));
  if (!s.connected) {
    s.connect();
  } else {
    // Already connected — send auth immediately.
    s.emit('auth', { token });
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
