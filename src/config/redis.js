import { createClient } from 'redis';
/* eslint no-console: off */
/* eslint no-undef: off */

// Create Redis client
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({
  url: REDIS_URL,
});

// Handle connection events
redisClient.on('connect', () => {
  console.log('Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('reconnecting', () => {
  console.log('Redis client reconnecting');
});

// Initialize connection
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// Cache expiration times (in seconds)
const CACHE_TTL = {
  CHAT_ROOMS: 60 * 15, // 15 minutes
  MESSAGES: 60 * 5, // 5 minutes
  PARTICIPANTS: 60 * 10, // 10 minutes
};

export { redisClient, CACHE_TTL };
