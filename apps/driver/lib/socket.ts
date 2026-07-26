import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

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

export function connectSocket(getToken: () => Promise<string | null>): Socket {
  const s = getSocket();
  if (s.connected) {
    getToken().then((token) => {
      if (token) s.emit('auth', { token });
    });
  } else {
    s.off('connect'); // remove any previously registered connect listener before adding a new one
    s.on('connect', () => {
      getToken().then((token) => {
        if (token) {
          s.emit('auth', { token });
        } else {
          s.disconnect();
        }
      });
    });
    s.on('connect_error', (err) => console.warn(`[socket] connect_error: ${err.message}`));
    s.on('auth.error', (data: unknown) => console.warn(`[socket] auth.error`, JSON.stringify(data)));
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
