// WS smoke test: verifies Socket.IO is mounted, reachable over the real
// websocket transport, and that the auth handshake round-trips.
//
//   node scripts/ws-smoke.mjs [BASE_URL] [CLERK_JWT]
//
// Without a token it only proves the gateway accepts connections.
// With a token it proves auth + registry work end to end.
import { io } from 'socket.io-client';

const base = process.argv[2] ?? 'http://localhost:8080';
const token = process.argv[3];

const fail = (msg) => { console.error(`FAIL  ${msg}`); process.exit(1); };
const timer = setTimeout(() => fail('timed out after 10s'), 10_000);

const socket = io(base, {
  path: '/ws',
  transports: ['websocket'],   // force real WS, no polling fallback
  reconnection: false,
});

socket.on('connect', () => {
  console.log(`OK    connected sid=${socket.id} transport=${socket.io.engine.transport.name}`);
  if (!token) { clearTimeout(timer); socket.close(); process.exit(0); }
  socket.emit('auth', { token });
});

socket.on('auth.ok', (p) => {
  console.log(`OK    auth.ok role=${p.role} userId=${p.userId}`);
  clearTimeout(timer);
  socket.close();
  process.exit(0);
});

socket.on('auth.error', (p) => fail(`auth.error ${JSON.stringify(p)}`));
socket.on('connect_error', (err) => fail(`connect_error ${err.message}`));
socket.on('disconnect', (reason) => fail(`disconnected early: ${reason}`));
