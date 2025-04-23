import { prisma } from '../config/prismaClient.js';
// Removed unused import for 'emitToRoom'

/* eslint no-console: off */
/**
 * Set up chat-related socket event handlers
 * @param {Object} io - Socket.IO server instance
 */
export const setupChatHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Join user's personal room for direct messages
    socket.join(`user:${socket.user.id}`);

    // Send the user's online status to relevant rooms
    socket.broadcast.emit('user:status', {
      userId: socket.user.id,
      status: 'online',
    });

    // Handle joining a chat room
    socket.on('chat:join', async ({ chatRoomId }) => {
      try {
        // Check if user is a participant in this chat
        const participant = await prisma.chatParticipant.findUnique({
          where: {
            chatRoomId_userId: {
              chatRoomId,
              userId: socket.user.id,
            },
          },
        });

        if (!participant) {
          throw new Error('Not authorized to join this chat room');
        }

        // Join the room
        socket.join(`chat:${chatRoomId}`);

        // Update participant's last seen status
        await prisma.chatParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            lastReadAt: new Date(),
          },
        });

        // Notify other users in the room
        socket.to(`chat:${chatRoomId}`).emit('chat:user-joined', {
          userId: socket.user.id,
          username: socket.user.username,
        });

        console.log(
          `User ${socket.user.username} joined chat room ${chatRoomId}`,
        );
      } catch (error) {
        console.error('Error joining chat room:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle leaving a chat room
    socket.on('chat:leave', ({ chatRoomId }) => {
      socket.leave(`chat:${chatRoomId}`);
      socket.to(`chat:${chatRoomId}`).emit('chat:user-left', {
        userId: socket.user.id,
        username: socket.user.username,
      });
      console.log(`User ${socket.user.username} left chat room ${chatRoomId}`);
    });

    // Handle sending a message
    socket.on('chat:message', async (messageData) => {
      try {
        const {
          chatRoomId,
          content,
          contentType = 'TEXT',
          replyToId = null,
          metadata = null,
        } = messageData;

        // Verify chat room exists and user is a participant
        const chatRoom = await prisma.chatRoom.findUnique({
          where: {
            id: chatRoomId,
            isActive: true,
            participants: {
              some: {
                userId: socket.user.id,
                status: 'ACTIVE',
              },
            },
          },
        });

        if (!chatRoom) {
          throw new Error('Chat room not found or you are not a participant');
        }

        // Create the message in the database
        const message = await prisma.chatMessage.create({
          data: {
            chatRoomId,
            senderId: socket.user.id,
            content,
            contentType,
            replyToId,
            metadata,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
            replyTo: {
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        });

        // Update the chat room's last message time
        await prisma.chatRoom.update({
          where: { id: chatRoomId },
          data: { lastMessageAt: new Date() },
        });

        // Emit the message to all users in the chat room
        io.to(`chat:${chatRoomId}`).emit('chat:message', message);

        // Update the sender's last read message
        await prisma.chatParticipant.update({
          where: {
            chatRoomId_userId: {
              chatRoomId,
              userId: socket.user.id,
            },
          },
          data: {
            lastReadMessageId: message.id,
            lastReadAt: new Date(),
          },
        });

        console.log(
          `Message sent in room ${chatRoomId} by ${socket.user.username}`,
        );
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle message read receipts
    socket.on('chat:read', async ({ chatRoomId, messageId }) => {
      try {
        // Update the participant's last read message
        await prisma.chatParticipant.update({
          where: {
            chatRoomId_userId: {
              chatRoomId,
              userId: socket.user.id,
            },
          },
          data: {
            lastReadMessageId: messageId,
            lastReadAt: new Date(),
          },
        });

        // Notify other participants about read receipt
        socket.to(`chat:${chatRoomId}`).emit('chat:read', {
          chatRoomId,
          userId: socket.user.id,
          messageId,
          readAt: new Date(),
        });
      } catch (error) {
        console.error('Error updating read receipt:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle message reactions
    socket.on('chat:reaction', async ({ messageId, reaction }) => {
      try {
        // Find the message to get its chat room
        const message = await prisma.chatMessage.findUnique({
          where: { id: messageId },
          select: { chatRoomId: true },
        });

        if (!message) {
          throw new Error('Message not found');
        }

        // Create or update reaction
        const existingReaction = await prisma.messageReaction.findFirst({
          where: {
            messageId,
            userId: socket.user.id,
            reaction,
          },
        });

        let messageReaction;

        if (existingReaction) {
          // Remove the reaction if it already exists (toggle behavior)
          await prisma.messageReaction.delete({
            where: { id: existingReaction.id },
          });
          messageReaction = null;
        } else {
          // Create new reaction
          messageReaction = await prisma.messageReaction.create({
            data: {
              messageId,
              userId: socket.user.id,
              reaction,
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  profilePic: true,
                },
              },
            },
          });
        }

        // Emit to all users in the chat room
        io.to(`chat:${message.chatRoomId}`).emit('chat:reaction', {
          messageId,
          reaction: messageReaction,
          removed: !messageReaction,
          userId: socket.user.id,
        });
      } catch (error) {
        console.error('Error processing reaction:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle user typing indicator
    socket.on('chat:typing', ({ chatRoomId, isTyping }) => {
      socket.to(`chat:${chatRoomId}`).emit('chat:typing', {
        userId: socket.user.id,
        username: socket.user.username,
        isTyping,
      });
    });

    // Handle message editing
    socket.on('chat:edit', async ({ messageId, content }) => {
      try {
        // Find the message and verify ownership
        const message = await prisma.chatMessage.findFirst({
          where: {
            id: messageId,
            senderId: socket.user.id,
            isDeleted: false,
          },
          select: { chatRoomId: true },
        });

        if (!message) {
          throw new Error('Message not found or you are not the sender');
        }

        // Update the message
        const updatedMessage = await prisma.chatMessage.update({
          where: { id: messageId },
          data: {
            content,
            isEdited: true,
            updatedAt: new Date(),
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
          },
        });

        // Emit to all users in the chat room
        io.to(`chat:${message.chatRoomId}`).emit(
          'chat:message-edited',
          updatedMessage,
        );
      } catch (error) {
        console.error('Error editing message:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle message deletion
    socket.on('chat:delete', async ({ messageId }) => {
      try {
        // Find the message and verify ownership or admin status
        const message = await prisma.chatMessage.findFirst({
          where: { id: messageId },
          include: {
            chatRoom: true,
          },
        });

        if (!message) {
          throw new Error('Message not found');
        }

        // Check if user is message sender or chat admin
        const isAdmin = await prisma.chatParticipant.findFirst({
          where: {
            chatRoomId: message.chatRoomId,
            userId: socket.user.id,
            isAdmin: true,
          },
        });

        if (message.senderId !== socket.user.id && !isAdmin) {
          throw new Error('You do not have permission to delete this message');
        }

        // Soft delete the message
        await prisma.chatMessage.update({
          where: { id: messageId },
          data: {
            isDeleted: true,
            content: 'This message was deleted',
            deletedAt: new Date(),
          },
        });

        // Emit to all users in the chat room
        io.to(`chat:${message.chatRoomId}`).emit('chat:message-deleted', {
          messageId,
          chatRoomId: message.chatRoomId,
          deletedBy: socket.user.id,
        });
      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Broadcast user's offline status
      socket.broadcast.emit('user:status', {
        userId: socket.user.id,
        status: 'offline',
      });
      console.log(`User disconnected: ${socket.user.username} (${socket.id})`);
    });
  });
};
