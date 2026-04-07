const Redis = require('ioredis');
const redis = new Redis({ host: 'localhost', port: 6379 });
redis.info().then(info => {
  const version = info.split('\n').find(line => line.startsWith('redis_version:'));
  console.log('Detected Redis Version:', version);
  process.exit(0);
}).catch(err => {
  console.error('Error connecting to Redis:', err.message);
  process.exit(1);
});
