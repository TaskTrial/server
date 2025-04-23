import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyToken } from '../utils/token.utils.js';
import { prisma } from '../config/prismaClient.js';
import { setupChatHandlers } from './chatHandlers.js';
import { setupVideoHandlers } from './videoHandlers.js';

let io;

/* eslint no-console: off */
/* eslint no-undef: off */

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 */
export const initializeSocketServer = async (httpServer) => {
  try {
    // Create Redis client for Socket.IO adapter if Redis URL is provided
    let pubClient, subClient;

    if (process.env.REDIS_URL) {
      pubClient = createClient({ url: process.env.REDIS_URL });
      subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);
      console.log('Connected to Redis for Socket.IO adapter');
    }

    // Create Socket.IO server
    io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
    });

    // Use Redis adapter if Redis is available
    if (pubClient && subClient) {
      io.adapter(createAdapter(pubClient, subClient));
    }

    // Middleware for authentication
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: Token required'));
        }

        const decoded = verifyToken(token);
        if (!decoded) {
          return next(new Error('Authentication error: Invalid token'));
        }

        // Fetch user from database to ensure they still exist and are active
        const user = await prisma.user.findUnique({
          where: {
            id: decoded.id,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            firstName: true,
            lastName: true,
            profilePic: true,
            organizationId: true,
          },
        });

        if (!user) {
          return next(
            new Error('Authentication error: User not found or inactive'),
          );
        }

        // Attach user data to socket
        socket.user = user;

        // Join the user to their organization room
        if (user.organizationId) {
          socket.join(`org:${user.organizationId}`);
        }

        // Find user's team memberships and join those rooms
        const teamMemberships = await prisma.teamMember.findMany({
          where: {
            userId: user.id,
            isActive: true,
          },
          select: {
            teamId: true,
          },
        });

        teamMemberships.forEach((membership) => {
          socket.join(`team:${membership.teamId}`);
        });

        // Find user's project memberships and join those rooms
        const projectMemberships = await prisma.projectMember.findMany({
          where: {
            userId: user.id,
            isActive: true,
          },
          select: {
            projectId: true,
          },
        });

        projectMemberships.forEach((membership) => {
          socket.join(`project:${membership.projectId}`);
        });

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication error'));
      }
    });

    // Set up event handlers
    setupChatHandlers(io);
    setupVideoHandlers(io);

    console.log('Socket.IO server initialized');
    return io;
  } catch (error) {
    console.error('Failed to initialize Socket.IO server:', error);
    throw error;
  }
};

/**
 * Get the Socket.IO instance
 * @returns {Object} Socket.IO instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
};

/**
 * Emit an event to a specific room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
export const emitToRoom = (room, event, data) => {
  if (!io) {
    console.error('Socket.IO not initialized, cannot emit event');
    return;
  }
  io.to(room).emit(event, data);
};

/**
 * Emit an event to a specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
export const emitToUser = (userId, event, data) => {
  if (!io) {
    console.error('Socket.IO not initialized, cannot emit event');
    return;
  }
  io.to(`user:${userId}`).emit(event, data);
};
