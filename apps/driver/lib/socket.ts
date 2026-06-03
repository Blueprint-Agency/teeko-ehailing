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
  console.log(`[socket] connectSocket called. connected=${s.connected}`);
  if (s.connected) {
    getToken().then((token) => {
      if (token) s.emit('auth', { token });
    });
  } else {
    s.on('connect', () => {
      console.log(`[socket] connected — fetching fresh token`);
      getToken().then((token) => {
        if (token) {
          console.log(`[socket] emitting auth`);
          s.emit('auth', { token });
        } else {
          console.log(`[socket] no token — disconnecting`);
          s.disconnect();
        }
      });
    });
    s.on('connect_error', (err) => console.log(`[socket] connect_error: ${err.message}`));
    s.on('disconnect', (reason) => console.log(`[socket] disconnected: ${reason}`));
    s.on('auth.ok', (data: unknown) => console.log(`[socket] auth.ok`, JSON.stringify(data)));
    s.on('auth.error', (data: unknown) => console.log(`[socket] auth.error`, JSON.stringify(data)));
    console.log(`[socket] calling s.connect() to ${BASE_URL}`);
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
