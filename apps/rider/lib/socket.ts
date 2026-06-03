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
  if (!s.connected) s.connect();
  s.once('connect', () => s.emit('auth', { token }));
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
