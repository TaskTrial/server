import prisma from '../config/prismaClient.js';

/* eslint no-console: off */

const setupChatHandlers = (io, socket, user) => {
  // Join user to their chat rooms
  const joinUserRooms = async () => {
    try {
      const chatParticipations = await prisma.chatParticipant.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
        select: {
          chatRoomId: true,
        },
      });

      chatParticipations.forEach((participation) => {
        socket.join(participation.chatRoomId);
      });

      console.log(`User ${user.id} joined their chat rooms`);
    } catch (error) {
      console.error('Error joining user rooms:', error);
    }
  };

  // Handle joining a specific chat room
  const joinChatRoom = async (chatRoomId, callback) => {
    try {
      // Verify user is a participant
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        callback({ error: 'Not authorized to join this chat room' });
        return;
      }

      socket.join(chatRoomId);
      callback({ success: true });
    } catch (error) {
      console.error('Error joining chat room:', error);
      callback({ error: 'Failed to join chat room' });
    }
  };

  // Handle sending a message
  const sendMessage = async (data, callback) => {
    try {
      const {
        chatRoomId,
        content,
        contentType = 'TEXT',
        replyToId = null,
        metadata = null,
      } = data;

      // Verify user is a participant
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        callback({
          error: 'Not authorized to send messages in this chat room',
        });
        return;
      }

      // Create the message
      const message = await prisma.chatMessage.create({
        data: {
          chatRoomId,
          senderId: user.id,
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
            select: {
              id: true,
              content: true,
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

      // Update the chat room's last message timestamp
      await prisma.chatRoom.update({
        where: { id: chatRoomId },
        data: { lastMessageAt: new Date() },
      });

      // Update the sender's read status
      await prisma.chatParticipant.update({
        where: {
          chatRoomId_userId: {
            chatRoomId,
            userId: user.id,
          },
        },
        data: {
          lastReadMessageId: message.id,
          lastReadAt: new Date(),
        },
      });

      // Emit the message to everyone in the chat room
      io.to(chatRoomId).emit('new_message', message);

      callback({ success: true, message });
    } catch (error) {
      console.error('Error sending message:', error);
      callback({ error: 'Failed to send message' });
    }
  };

  // Handle attachment notifications
  const notifyAttachment = async (data, callback) => {
    try {
      const { chatRoomId, messageId, attachments } = data;

      // Verify user is a participant
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        if (callback) {
          callback({ error: 'Not authorized for this chat room' });
        }
        return;
      }

      // Get the message to verify it exists
      const message = await prisma.chatMessage.findUnique({
        where: {
          id: messageId,
          chatRoomId,
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

      if (!message) {
        if (callback) {
          callback({ error: 'Message not found' });
        }
        return;
      }

      // Broadcast the attachment notification to all users in the chat room
      io.to(chatRoomId).emit('attachment_added', {
        messageId,
        chatRoomId,
        attachments,
        message,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error handling attachment notification:', error);
      if (callback) {
        callback({ error: 'Failed to process attachment notification' });
      }
    }
  };

  // Handle typing status
  const typingStatus = (data) => {
    const { chatRoomId, isTyping } = data;

    // Broadcast typing status to everyone in the room except sender
    socket.to(chatRoomId).emit('typing_status', {
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      isTyping,
      chatRoomId,
    });
  };

  // Handle message reactions
  const reactToMessage = async (data, callback) => {
    try {
      const { messageId, reaction } = data;

      // Get the message to verify it exists and get the chat room ID
      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: { chatRoomId: true },
      });

      if (!message) {
        callback({ error: 'Message not found' });
        return;
      }

      // Verify user is a participant in the chat room
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId: message.chatRoomId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        callback({
          error: 'Not authorized to react to messages in this chat room',
        });
        return;
      }

      // Check if user already reacted with this reaction
      const existingReaction = await prisma.messageReaction.findUnique({
        where: {
          messageId_userId_reaction: {
            messageId,
            userId: user.id,
            reaction,
          },
        },
      });

      let result;

      if (existingReaction) {
        // Remove the reaction if it already exists (toggle)
        await prisma.messageReaction.delete({
          where: {
            messageId_userId_reaction: {
              messageId,
              userId: user.id,
              reaction,
            },
          },
        });
        result = { success: true, removed: true };
      } else {
        // Add the reaction
        const newReaction = await prisma.messageReaction.create({
          data: {
            messageId,
            userId: user.id,
            reaction,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
        result = { success: true, reaction: newReaction };
      }

      // Get all reactions for this message to broadcast
      const allReactions = await prisma.messageReaction.findMany({
        where: { messageId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Broadcast updated reactions to everyone in the chat room
      io.to(message.chatRoomId).emit('message_reaction_update', {
        messageId,
        reactions: allReactions,
      });

      callback(result);
    } catch (error) {
      console.error('Error handling reaction:', error);
      callback({ error: 'Failed to process reaction' });
    }
  };

  // Handle marking messages as read
  const markAsRead = async (data, callback) => {
    try {
      const { chatRoomId, messageId } = data;

      // Verify user is a participant
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        callback({ error: 'Not authorized for this chat room' });
        return;
      }

      // Update read status
      await prisma.chatParticipant.update({
        where: {
          chatRoomId_userId: {
            chatRoomId,
            userId: user.id,
          },
        },
        data: {
          lastReadMessageId: messageId,
          lastReadAt: new Date(),
        },
      });

      // Emit read status to others in the room
      socket.to(chatRoomId).emit('read_status_update', {
        chatRoomId,
        userId: user.id,
        lastReadMessageId: messageId,
        lastReadAt: new Date(),
      });

      callback({ success: true });
    } catch (error) {
      console.error('Error marking as read:', error);
      callback({ error: 'Failed to update read status' });
    }
  };

  // Handle deleting a message
  const deleteMessage = async (data, callback) => {
    try {
      const { messageId } = data;

      // Get the message
      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: { chatRoomId: true, senderId: true },
      });

      if (!message) {
        callback({ error: 'Message not found' });
        return;
      }

      // Check if user is the sender or an admin
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId: message.chatRoomId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        callback({ error: 'Not authorized for this chat room' });
        return;
      }

      // Only message sender or admin can delete
      if (message.senderId !== user.id && !participant.isAdmin) {
        callback({ error: 'Not authorized to delete this message' });
        return;
      }

      // Soft delete the message
      await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          content: 'This message has been deleted',
          deletedAt: new Date(),
          deletedBy: user.id,
        },
      });

      // Notify everyone in the room
      io.to(message.chatRoomId).emit('message_deleted', {
        messageId,
        chatRoomId: message.chatRoomId,
      });

      callback({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      callback({ error: 'Failed to delete message' });
    }
  };

  // Handle updating a message
  const editMessage = async (data, callback) => {
    try {
      const { messageId, content } = data;

      // Get the message
      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: { chatRoomId: true, senderId: true },
      });

      if (!message) {
        callback({ error: 'Message not found' });
        return;
      }

      // Only message sender can edit
      if (message.senderId !== user.id) {
        callback({ error: 'Not authorized to edit this message' });
        return;
      }

      // Update the message
      const updatedMessage = await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          content,
          isEdited: true,
          editedAt: new Date(),
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
            select: {
              id: true,
              content: true,
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

      // Notify everyone in the room
      io.to(message.chatRoomId).emit('message_updated', updatedMessage);

      callback({ success: true, message: updatedMessage });
    } catch (error) {
      console.error('Error editing message:', error);
      callback({ error: 'Failed to edit message' });
    }
  };

  // Handle user leaving a chat room
  const leaveChatRoom = async (chatRoomId, callback) => {
    try {
      socket.leave(chatRoomId);

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error leaving chat room:', error);
      if (callback) {
        callback({ error: 'Failed to leave chat room' });
      }
    }
  };

  // Register event handlers
  socket.on('join_chat_rooms', joinUserRooms);
  socket.on('join_chat_room', joinChatRoom);
  socket.on('leave_chat_room', leaveChatRoom);
  socket.on('send_message', sendMessage);
  socket.on('typing_status', typingStatus);
  socket.on('react_to_message', reactToMessage);
  socket.on('mark_as_read', markAsRead);
  socket.on('delete_message', deleteMessage);
  socket.on('edit_message', editMessage);
  socket.on('notify_attachment', notifyAttachment);

  // Initialize by joining user's rooms
  joinUserRooms();

  return {
    disconnect: () => {
      socket.removeAllListeners('join_chat_rooms');
      socket.removeAllListeners('join_chat_room');
      socket.removeAllListeners('leave_chat_room');
      socket.removeAllListeners('send_message');
      socket.removeAllListeners('typing_status');
      socket.removeAllListeners('react_to_message');
      socket.removeAllListeners('mark_as_read');
      socket.removeAllListeners('delete_message');
      socket.removeAllListeners('edit_message');
      socket.removeAllListeners('notify_attachment');
    },
  };
};

export default setupChatHandlers;
