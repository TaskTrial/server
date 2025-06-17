import { redisClient, CACHE_TTL } from '../config/redis.js';
/* eslint no-console: off */

/**
 * Chat room cache utility
 */
export const chatRoomCache = {
  /**
   * Get a chat room by ID from cache
   * @param {string} id - Chat room ID
   * @returns {Promise<Object|null>} - Chat room object or null if not found
   */
  async get(id) {
    try {
      const cached = await redisClient.get(`chat:room:${id}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Error getting chat room from cache:', err);
      return null;
    }
  },

  /**
   * Set a chat room in cache
   * @param {string} id - Chat room ID
   * @param {Object} data - Chat room data
   * @returns {Promise<boolean>} - Success status
   */
  async set(id, data) {
    try {
      await redisClient.set(`chat:room:${id}`, JSON.stringify(data), {
        EX: CACHE_TTL.CHAT_ROOMS,
      });
      return true;
    } catch (err) {
      console.error('Error setting chat room in cache:', err);
      return false;
    }
  },

  /**
   * Delete a chat room from cache
   * @param {string} id - Chat room ID
   * @returns {Promise<boolean>} - Success status
   */
  async delete(id) {
    try {
      await redisClient.del(`chat:room:${id}`);
      return true;
    } catch (err) {
      console.error('Error deleting chat room from cache:', err);
      return false;
    }
  },

  /**
   * Get user's chat rooms from cache
   * @param {string} userId - User ID
   * @returns {Promise<Array|null>} - Array of chat rooms or null if not found
   */
  async getUserRooms(userId) {
    try {
      const cached = await redisClient.get(`user:${userId}:chatrooms`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Error getting user chat rooms from cache:', err);
      return null;
    }
  },

  /**
   * Set user's chat rooms in cache
   * @param {string} userId - User ID
   * @param {Array} rooms - Chat rooms data
   * @returns {Promise<boolean>} - Success status
   */
  async setUserRooms(userId, rooms) {
    try {
      await redisClient.set(`user:${userId}:chatrooms`, JSON.stringify(rooms), {
        EX: CACHE_TTL.CHAT_ROOMS,
      });
      return true;
    } catch (err) {
      console.error('Error setting user chat rooms in cache:', err);
      return false;
    }
  },

  /**
   * Delete user's chat rooms from cache
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteUserRooms(userId) {
    try {
      await redisClient.del(`user:${userId}:chatrooms`);
      return true;
    } catch (err) {
      console.error('Error deleting user chat rooms from cache:', err);
      return false;
    }
  },
};

/**
 * Chat messages cache utility
 */
export const chatMessagesCache = {
  /**
   * Get messages for a chat room from cache
   * @param {string} roomId - Chat room ID
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object|null>} - Messages with pagination or null if not found
   */
  async get(roomId, page = 1, limit = 20) {
    try {
      const cached = await redisClient.get(
        `chat:room:${roomId}:messages:${page}:${limit}`,
      );
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Error getting messages from cache:', err);
      return null;
    }
  },

  /**
   * Set messages for a chat room in cache
   * @param {string} roomId - Chat room ID
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {Object} data - Messages data with pagination
   * @returns {Promise<boolean>} - Success status
   */
  async set(roomId, page = 1, limit = 20, data) {
    try {
      await redisClient.set(
        `chat:room:${roomId}:messages:${page}:${limit}`,
        JSON.stringify(data),
        { EX: CACHE_TTL.MESSAGES },
      );
      return true;
    } catch (err) {
      console.error('Error setting messages in cache:', err);
      return false;
    }
  },

  /**
   * Invalidate all messages cache for a chat room
   * @param {string} roomId - Chat room ID
   * @returns {Promise<boolean>} - Success status
   */
  async invalidate(roomId) {
    try {
      // Use scan to find all keys matching the pattern and delete them
      let cursor = 0;
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: `chat:room:${roomId}:messages:*`,
          COUNT: 100,
        });
        cursor = result.cursor;

        if (result.keys.length > 0) {
          await redisClient.del(result.keys);
        }
      } while (cursor !== 0);

      return true;
    } catch (err) {
      console.error('Error invalidating messages cache:', err);
      return false;
    }
  },
};

/**
 * Chat participants cache utility
 */
export const chatParticipantsCache = {
  /**
   * Get participants for a chat room from cache
   * @param {string} roomId - Chat room ID
   * @returns {Promise<Array|null>} - Array of participants or null if not found
   */
  async get(roomId) {
    try {
      const cached = await redisClient.get(`chat:room:${roomId}:participants`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Error getting participants from cache:', err);
      return null;
    }
  },

  /**
   * Set participants for a chat room in cache
   * @param {string} roomId - Chat room ID
   * @param {Array} data - Participants data
   * @returns {Promise<boolean>} - Success status
   */
  async set(roomId, data) {
    try {
      await redisClient.set(
        `chat:room:${roomId}:participants`,
        JSON.stringify(data),
        { EX: CACHE_TTL.PARTICIPANTS },
      );
      return true;
    } catch (err) {
      console.error('Error setting participants in cache:', err);
      return false;
    }
  },

  /**
   * Invalidate participants cache for a chat room
   * @param {string} roomId - Chat room ID
   * @returns {Promise<boolean>} - Success status
   */
  async invalidate(roomId) {
    try {
      await redisClient.del(`chat:room:${roomId}:participants`);
      return true;
    } catch (err) {
      console.error('Error invalidating participants cache:', err);
      return false;
    }
  },
};
