const { createRequire } = require('module');
const requireFromCwd = createRequire(`${process.cwd()}/package.json`);
const { io } = requireFromCwd('socket.io-client');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const WS_URL = process.env.WS_URL || 'http://localhost:3001/ws';
const CLIENTS = Number(process.env.CLIENTS || 50);
const MESSAGES_PER_CLIENT = Number(process.env.MESSAGES || 10);
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 100);

const USER_EMAIL = process.env.USER_EMAIL || 'userA@example.com';
const USER_PASSWORD = process.env.USER_PASSWORD || 'Password123!';

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }
  const data = await res.json();
  return data.accessToken;
}

async function getRoomId(token) {
  const res = await fetch(`${API_URL}/rooms`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Rooms fetch failed: ${res.status}`);
  const rooms = await res.json();
  const group = rooms.find((r) => r.type === 'group') || rooms[0];
  if (!group) throw new Error('No room found');
  return group._id;
}

async function run() {
  const token = await login();
  const roomId = await getRoomId(token);

  const metrics = {
    sent: 0,
    acked: 0,
    errors: 0,
    rateLimited: 0,
    latencies: [],
  };

  const sockets = [];
  for (let i = 0; i < CLIENTS; i++) {
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    socket.on('error', (err) => {
      metrics.errors += 1;
      const msg = err?.message || '';
      if (/rate/i.test(msg)) metrics.rateLimited += 1;
    });
  }

  await Promise.all(
    sockets.map(
      (s) =>
        new Promise((resolve) => {
          s.on('connect', () => resolve());
        }),
    ),
  );

  sockets.forEach((s) => s.emit('join_room', { roomId }));

  const start = Date.now();
  const sendPromises = sockets.map((socket, idx) =>
    sendMessages(socket, roomId, idx, metrics),
  );
  await Promise.all(sendPromises);

  const durationMs = Date.now() - start;
  const avgLatency =
    metrics.latencies.length > 0
      ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
      : 0;

  sockets.forEach((s) => s.disconnect());

  console.log('LOAD TEST SUMMARY');
  console.log(`clients=${CLIENTS} messages_per_client=${MESSAGES_PER_CLIENT}`);
  console.log(`sent=${metrics.sent} acked=${metrics.acked} errors=${metrics.errors}`);
  console.log(`rate_limited=${metrics.rateLimited}`);
  console.log(`avg_ack_latency_ms=${avgLatency.toFixed(1)}`);
  console.log(`duration_ms=${durationMs}`);
}

async function sendMessages(socket, roomId, idx, metrics) {
  for (let i = 0; i < MESSAGES_PER_CLIENT; i++) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    const clientMessageId = `lt-${idx}-${i}-${Date.now()}`;
    const start = Date.now();
    metrics.sent += 1;
    await new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        metrics.errors += 1;
        resolve();
      }, 5000);
      socket.emit(
        'send_message',
        { roomId, content: `load ${idx}:${i}`, clientMessageId },
        (ack) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (ack?.ok) {
            metrics.acked += 1;
            metrics.latencies.push(Date.now() - start);
          } else {
            metrics.errors += 1;
          }
          resolve();
        },
      );
    });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
