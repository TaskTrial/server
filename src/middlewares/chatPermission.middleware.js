import prisma from '../config/prismaClient.js';
import { ApiError } from '../utils/errorCodes.utils.js';

/**
 * Middleware to verify user is a participant in a chat room
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const verifyChatParticipant = async (req, res, next) => {
  try {
    const chatRoomId = req.params.id || req.params.chatRoomId;
    const userId = req.user.id;

    if (!chatRoomId) {
      return res
        .status(400)
        .json(
          ApiError.validationError([
            'Chat room ID is required in route parameters',
          ]),
        );
    }

    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json(ApiError.notChatParticipant(chatRoomId));
    }

    // Add participant info to the request for use in route handlers
    req.chatParticipant = participant;
    next();
  } catch (error) {
    /* eslint no-console: off */
    console.error('Error in verifyChatParticipant middleware:', error);
    return res
      .status(500)
      .json(ApiError.serverError('Error verifying chat permission', error));
  }
};

/**
 * Middleware to verify user is an admin in a chat room
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const verifyChatAdmin = async (req, res, next) => {
  try {
    const chatRoomId = req.params.id || req.params.chatRoomId;
    const userId = req.user.id;

    if (!chatRoomId) {
      return res
        .status(400)
        .json(
          ApiError.validationError([
            'Chat room ID is required in route parameters',
          ]),
        );
    }

    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json(ApiError.notChatParticipant(chatRoomId));
    }

    if (!participant.isAdmin) {
      return res
        .status(403)
        .json(
          ApiError.forbidden('Only chat room admins can perform this action'),
        );
    }

    // Add participant info to the request for use in route handlers
    req.chatParticipant = participant;
    next();
  } catch (error) {
    console.error('Error in verifyChatAdmin middleware:', error);
    return res
      .status(500)
      .json(ApiError.serverError('Error verifying admin permission', error));
  }
};

/**
 * Middleware to verify user owns a message or is an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const verifyMessageOwnership = async (req, res, next) => {
  try {
    const chatRoomId = req.params.id || req.params.chatRoomId;
    const messageId = req.params.messageId;
    const userId = req.user.id;

    if (!messageId) {
      return res
        .status(400)
        .json(
          ApiError.validationError([
            'Message ID is required in route parameters',
          ]),
        );
    }

    // First check if user is a participant
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json(ApiError.notChatParticipant(chatRoomId));
    }

    // Get the message
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { senderId: true, chatRoomId: true },
    });

    if (!message) {
      return res.status(404).json(ApiError.notFound('Message', messageId));
    }

    // Verify message belongs to this chat room
    if (message.chatRoomId !== chatRoomId) {
      return res.status(404).json(ApiError.notFound('Message', messageId));
    }

    // Check if user is the message sender or an admin
    if (message.senderId !== userId && !participant.isAdmin) {
      return res
        .status(403)
        .json(
          ApiError.forbidden(
            'You do not have permission to perform this action on this message',
          ),
        );
    }

    // Add message and participant info to request for use in route handlers
    req.message = message;
    req.chatParticipant = participant;
    next();
  } catch (error) {
    console.error('Error in verifyMessageOwnership middleware:', error);
    return res
      .status(500)
      .json(ApiError.serverError('Error verifying message ownership', error));
  }
};
