const { io } = require('socket.io-client');
const Redis = require('ioredis');
const fetch = global.fetch || require('node-fetch');

const BASE_URL = process.env.STRESS_BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = process.env.STRESS_JWT;
const CONNECTIONS = Number(process.env.STRESS_CONNECTIONS || 1000);
const ROOMS = Number(process.env.STRESS_ROOMS || 50);
const BURST = Number(process.env.STRESS_BURST || 5);

if (!TOKEN) {
  console.error('STRESS_JWT is required');
  process.exit(1);
}

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
});

const sampleMetrics = async (label) => {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const info = await redis.info('stats');
  const ops = info.split('\n').find((l) => l.startsWith('instantaneous_ops_per_sec')) || '';
  console.log(JSON.stringify({
    label,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    cpuUser: cpu.user,
    cpuSystem: cpu.system,
    redisOps: ops.split(':')[1]?.trim() || 'n/a',
  }));
};

(async () => {
  await sampleMetrics('start');

  const roomIds = [];
  for (let i = 0; i < ROOMS; i += 1) {
    const res = await fetch(`${BASE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ name: `room-${i}`, type: 'group' }),
    });
    const room = await res.json();
    roomIds.push(room._id || room.id || `room-${i}`);
  }

  const sockets = [];
  for (let i = 0; i < CONNECTIONS; i += 1) {
    sockets.push(io(`${BASE_URL}/ws`, { auth: { token: TOKEN }, transports: ['websocket'] }));
  }

  await Promise.all(sockets.map((s) => new Promise((res) => s.on('connect', res))));

  await Promise.all(
    sockets.map((s, idx) =>
      new Promise((res) => s.emit('join_room', { roomId: roomIds[idx % ROOMS] }, res)),
    ),
  );

  const seen = new Set();
  let duplicates = 0;
  sockets.forEach((s) =>
    s.on('message', (msg) => {
      const id = msg._id || msg.id;
      if (seen.has(id)) duplicates += 1;
      else seen.add(id);
    }),
  );

  for (let i = 0; i < BURST; i += 1) {
    await Promise.all(
      sockets.map((s, idx) =>
        new Promise((res) =>
          s.emit(
            'send_message',
            { roomId: roomIds[idx % ROOMS], content: `burst-${i}-${idx}` },
            res,
          ),
        ),
      ),
    );
  }

  await new Promise((r) => setTimeout(r, 2000));
  await sampleMetrics('end');
  console.log(JSON.stringify({ duplicates }));

  sockets.forEach((s) => s.disconnect());
  await redis.quit();
})();
