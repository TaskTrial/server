import prisma from '../config/prismaClient.js';
/* eslint no-console: off */

/**
 * @desc   Creates a new chat room
 * @route  /api/chat
 * @method POST
 * @access private
 */
export const createChatRoom = async (req, res) => {
  try {
    // TODO: Joi validation

    const { name, description, type, entityType, entityId } = req.body;
    const userId = req.user.id;

    // Verify entity exists
    const entity = await verifyEntity(entityType, entityId);
    if (!entity) {
      return res.status(404).json({ message: `${entityType} not found` });
    }

    // Check if chat room already exists for this entity
    const existingChatRoom = await prisma.chatRoom.findUnique({
      where: {
        entityType_entityId: {
          entityType,
          entityId,
        },
      },
    });

    if (existingChatRoom) {
      return res
        .status(409)
        .json({ message: `Chat room already exists for this ${entityType}` });
    }

    // Create new chat room
    const chatRoom = await prisma.chatRoom.create({
      data: {
        name: name || `${entityType} Chat`,
        description,
        type,
        entityType,
        entityId,
        lastMessageAt: new Date(),
      },
    });

    // Add the current user as a participant and admin
    await prisma.chatParticipant.create({
      data: {
        chatRoomId: chatRoom.id,
        userId,
        isAdmin: true,
      },
    });

    return res.status(201).json(chatRoom);
  } catch (error) {
    console.error('Error creating chat room:', error);
    return res
      .status(500)
      .json({ message: 'Failed to create chat room', error: error.message });
  }
};

/**
 * @desc   Creates all chat rooms
 * @route  /api/chat
 * @method GET
 * @access private
 */
export const getChatRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all chat rooms where the user is a participant
    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
        isActive: true,
      },
      include: {
        participants: {
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
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            content: true,
            contentType: true,
            createdAt: true,
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
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    // Get unread message counts for each chat room
    const chatRoomsWithUnread = await Promise.all(
      chatRooms.map(async (room) => {
        const participant = room.participants.find((p) => p.userId === userId);

        const unreadCount = await prisma.chatMessage.count({
          where: {
            chatRoomId: room.id,
            createdAt: {
              gt: participant.lastReadAt || new Date(0),
            },
            senderId: {
              not: userId,
            },
          },
        });

        return {
          ...room,
          unreadCount,
        };
      }),
    );

    return res.status(200).json(chatRoomsWithUnread);
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    return res
      .status(500)
      .json({ message: 'Failed to fetch chat rooms', error: error.message });
  }
};

/**
 * @desc   Get a chat room by id
 * @route  /api/chat/:id
 * @method GET
 * @access private
 */
export const getChatRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is a participant
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (!participant) {
      return res
        .status(403)
        .json({ message: 'You are not a participant in this chat room' });
    }

    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id },
      include: {
        participants: {
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
        },
      },
    });

    if (!chatRoom) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    return res.status(200).json(chatRoom);
  } catch (error) {
    console.error('Error fetching chat room:', error);
    return res
      .status(500)
      .json({ message: 'Failed to fetch chat room', error: error.message });
  }
};

/**
 * @desc   Get a chat room by id
 * @route  /api/chat/:id
 * @method PUT
 * @access private
 */
export const updateChatRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isArchived } = req.body;
    const userId = req.user.id;

    // Check if user is an admin participant
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (!participant || !participant.isAdmin) {
      return res.status(403).json({
        message: 'You do not have permission to update this chat room',
      });
    }

    const updatedData = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(isArchived !== undefined && {
        isArchived,
        ...(isArchived && { archivedAt: new Date() }),
      }),
      updatedAt: new Date(),
    };

    const chatRoom = await prisma.chatRoom.update({
      where: { id },
      data: updatedData,
    });

    return res.status(200).json(chatRoom);
  } catch (error) {
    console.error('Error updating chat room:', error);
    return res
      .status(500)
      .json({ message: 'Failed to update chat room', error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Check if user is a participant
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (!participant) {
      return res
        .status(403)
        .json({ message: 'You are not a participant in this chat room' });
    }

    // Get messages with pagination
    const messages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId: id,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limitNumber,
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
        reactions: {
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
        },
        attachments: true,
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

    const total = await prisma.chatMessage.count({
      where: {
        chatRoomId: id,
        isDeleted: false,
      },
    });

    // Update last read status for the user
    if (messages.length > 0) {
      await prisma.chatParticipant.update({
        where: {
          chatRoomId_userId: {
            chatRoomId: id,
            userId,
          },
        },
        data: {
          lastReadMessageId: messages[0].id,
          lastReadAt: new Date(),
        },
      });
    }

    return res.status(200).json({
      messages,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res
      .status(500)
      .json({ message: 'Failed to fetch messages', error: error.message });
  }
};

export const addParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body; // Array of user IDs to add
    const requestingUserId = req.user.id;

    // Check if requesting user is an admin
    const requestingParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId: requestingUserId,
        },
      },
    });

    if (!requestingParticipant || !requestingParticipant.isAdmin) {
      return res.status(403).json({
        message:
          'You do not have permission to add participants to this chat room',
      });
    }

    // Get current participants to avoid duplicates
    const currentParticipants = await prisma.chatParticipant.findMany({
      where: {
        chatRoomId: id,
      },
      select: {
        userId: true,
      },
    });

    const currentParticipantIds = currentParticipants.map((p) => p.userId);
    const newParticipantIds = userIds.filter(
      (userId) => !currentParticipantIds.includes(userId),
    );

    if (newParticipantIds.length === 0) {
      return res.status(400).json({
        message: 'All users are already participants in this chat room',
      });
    }

    // Add new participants
    const newParticipants = await prisma.$transaction(
      newParticipantIds.map((userId) =>
        prisma.chatParticipant.create({
          data: {
            chatRoomId: id,
            userId,
            isAdmin: false,
          },
        }),
      ),
    );

    // Create a system message about new participants
    const newUsernames = await prisma.user.findMany({
      where: {
        id: {
          in: newParticipantIds,
        },
      },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    const newUserNamesList = newUsernames
      .map((u) => `${u.firstName} ${u.lastName}`)
      .join(', ');

    await prisma.chatMessage.create({
      data: {
        chatRoomId: id,
        senderId: requestingUserId,
        content: `Added ${newUserNamesList} to the chat`,
        contentType: 'SYSTEM',
      },
    });

    // Update last message timestamp
    await prisma.chatRoom.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return res.status(200).json({ addedParticipants: newParticipants.length });
  } catch (error) {
    console.error('Error adding participants:', error);
    return res
      .status(500)
      .json({ message: 'Failed to add participants', error: error.message });
  }
};

export const removeParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requestingUserId = req.user.id;

    // Check if requesting user is an admin or the user themselves
    const requestingParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId: requestingUserId,
        },
      },
    });

    if (!requestingParticipant) {
      return res
        .status(403)
        .json({ message: 'You are not a participant in this chat room' });
    }

    // Only admins can remove others, but users can remove themselves
    if (requestingUserId !== userId && !requestingParticipant.isAdmin) {
      return res.status(403).json({
        message: 'You do not have permission to remove this participant',
      });
    }

    // Get the user being removed
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove the participant
    await prisma.chatParticipant.delete({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    // Add system message if someone is removed (not if they leave)
    if (requestingUserId !== userId) {
      await prisma.chatMessage.create({
        data: {
          chatRoomId: id,
          senderId: requestingUserId,
          content: `Removed ${user.firstName} ${user.lastName} from the chat`,
          contentType: 'SYSTEM',
        },
      });
    } else {
      await prisma.chatMessage.create({
        data: {
          chatRoomId: id,
          senderId: requestingUserId,
          content: `${user.firstName} ${user.lastName} left the chat`,
          contentType: 'SYSTEM',
        },
      });
    }

    // Update last message timestamp
    await prisma.chatRoom.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return res
      .status(200)
      .json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    return res
      .status(500)
      .json({ message: 'Failed to remove participant', error: error.message });
  }
};

export const makeAdmin = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requestingUserId = req.user.id;

    // Check if requesting user is an admin
    const requestingParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId: requestingUserId,
        },
      },
    });

    if (!requestingParticipant || !requestingParticipant.isAdmin) {
      return res.status(403).json({
        message:
          'You do not have permission to manage admins in this chat room',
      });
    }

    // Update participant to admin
    await prisma.chatParticipant.update({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
      data: {
        isAdmin: true,
      },
    });

    // Get the user who was made admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    // Create system message
    await prisma.chatMessage.create({
      data: {
        chatRoomId: id,
        senderId: requestingUserId,
        content: `${user.firstName} ${user.lastName} is now an admin`,
        contentType: 'SYSTEM',
      },
    });

    // Update last message timestamp
    await prisma.chatRoom.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return res.status(200).json({ message: 'User is now an admin' });
  } catch (error) {
    console.error('Error making admin:', error);
    return res
      .status(500)
      .json({ message: 'Failed to update admin status', error: error.message });
  }
};

export const removeAdmin = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requestingUserId = req.user.id;

    // Check if requesting user is an admin
    const requestingParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId: requestingUserId,
        },
      },
    });

    if (!requestingParticipant || !requestingParticipant.isAdmin) {
      return res.status(403).json({
        message:
          'You do not have permission to manage admins in this chat room',
      });
    }

    // Count admins to ensure at least one admin remains
    const adminCount = await prisma.chatParticipant.count({
      where: {
        chatRoomId: id,
        isAdmin: true,
      },
    });

    if (adminCount <= 1 && userId === requestingUserId) {
      return res
        .status(400)
        .json({ message: 'Cannot remove the last admin from the chat room' });
    }

    // Update participant to remove admin status
    await prisma.chatParticipant.update({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
      data: {
        isAdmin: false,
      },
    });

    // Get the user who was removed as admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    // Create system message
    await prisma.chatMessage.create({
      data: {
        chatRoomId: id,
        senderId: requestingUserId,
        content: `${user.firstName} ${user.lastName} is no longer an admin`,
        contentType: 'SYSTEM',
      },
    });

    // Update last message timestamp
    await prisma.chatRoom.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return res.status(200).json({ message: 'Admin status removed' });
  } catch (error) {
    console.error('Error removing admin status:', error);
    return res
      .status(500)
      .json({ message: 'Failed to update admin status', error: error.message });
  }
};

export const pinMessage = async (req, res) => {
  try {
    const { chatRoomId, messageId } = req.params;
    const userId = req.user.id;

    // Check if user is an admin
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!participant || !participant.isAdmin) {
      return res.status(403).json({
        message: 'You do not have permission to pin messages in this chat room',
      });
    }

    // Check if message exists and belongs to this chat room
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        chatRoomId,
      },
    });

    if (!message) {
      return res
        .status(404)
        .json({ message: 'Message not found in this chat room' });
    }

    // Check if already pinned
    const existingPin = await prisma.pinnedMessage.findUnique({
      where: {
        chatRoomId_messageId: {
          chatRoomId,
          messageId,
        },
      },
    });

    if (existingPin) {
      return res.status(409).json({ message: 'Message is already pinned' });
    }

    // Pin the message
    const pinnedMessage = await prisma.pinnedMessage.create({
      data: {
        chatRoomId,
        messageId,
        pinnedBy: userId,
      },
      include: {
        message: {
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

    return res.status(201).json(pinnedMessage);
  } catch (error) {
    console.error('Error pinning message:', error);
    return res
      .status(500)
      .json({ message: 'Failed to pin message', error: error.message });
  }
};

export const unpinMessage = async (req, res) => {
  try {
    const { chatRoomId, messageId } = req.params;
    const userId = req.user.id;

    // Check if user is an admin
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!participant || !participant.isAdmin) {
      return res.status(403).json({
        message:
          'You do not have permission to unpin messages in this chat room',
      });
    }

    // Unpin the message
    await prisma.pinnedMessage.delete({
      where: {
        chatRoomId_messageId: {
          chatRoomId,
          messageId,
        },
      },
    });

    return res.status(200).json({ message: 'Message unpinned successfully' });
  } catch (error) {
    console.error('Error unpinning message:', error);
    return res
      .status(500)
      .json({ message: 'Failed to unpin message', error: error.message });
  }
};

export const getPinnedMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is a participant
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (!participant) {
      return res
        .status(403)
        .json({ message: 'You are not a participant in this chat room' });
    }

    // Get pinned messages
    const pinnedMessages = await prisma.pinnedMessage.findMany({
      where: {
        chatRoomId: id,
      },
      include: {
        message: {
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
        },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        pinnedAt: 'desc',
      },
    });

    return res.status(200).json(pinnedMessages);
  } catch (error) {
    console.error('Error fetching pinned messages:', error);
    return res.status(500).json({
      message: 'Failed to fetch pinned messages',
      error: error.message,
    });
  }
};

// TODO: Message Reactions

// TODO: Message Attachments

// Helper function to verify entity exists
const verifyEntity = async (entityType, entityId) => {
  switch (entityType) {
    case 'ORGANIZATION':
      return await prisma.organization.findUnique({
        where: { id: entityId, deletedAt: null },
      });
    case 'DEPARTMENT':
      return await prisma.department.findUnique({
        where: { id: entityId, deletedAt: null },
      });
    case 'TEAM':
      return await prisma.team.findUnique({
        where: { id: entityId, deletedAt: null },
      });
    case 'PROJECT':
      return await prisma.project.findUnique({
        where: { id: entityId, deletedAt: null },
      });
    case 'TASK':
      return await prisma.task.findUnique({
        where: { id: entityId, deletedAt: null },
      });
    default:
      return null;
  }
};
