import { prisma } from '../config/prismaClient.js';
import { emitToRoom } from '../socket/socketServer.js';

/**
 * Create a new chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const createChatRoom = async (req, res) => {
  try {
    const { name, description, type, entityType, entityId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !type || !entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, entityType, or entityId',
      });
    }

    // Check if a chat room already exists for this entity
    const existingChatRoom = await prisma.chatRoom.findUnique({
      where: {
        entityType_entityId: {
          entityType,
          entityId,
        },
      },
    });

    if (existingChatRoom) {
      return res.status(400).json({
        success: false,
        message: 'A chat room for this entity already exists',
      });
    }

    // Create the chat room
    const chatRoom = await prisma.chatRoom.create({
      data: {
        name,
        description,
        type,
        entityType,
        entityId,
      },
    });

    // Add the creator as an admin participant
    await prisma.chatParticipant.create({
      data: {
        chatRoomId: chatRoom.id,
        userId,
        isAdmin: true,
      },
    });

    // Add participants based on the entity type
    let participants = [];

    switch (entityType) {
      case 'ORGANIZATION':
        // Add all organization members
        participants = await prisma.user.findMany({
          where: {
            organizationId: entityId,
            isActive: true,
          },
          select: {
            id: true,
          },
        });
        break;

      case 'DEPARTMENT':
        // Add all department members
        participants = await prisma.user.findMany({
          where: {
            departmentId: entityId,
            isActive: true,
          },
          select: {
            id: true,
          },
        });
        break;

      case 'TEAM':
        // Add all team members
        const teamMembers = await prisma.teamMember.findMany({
          where: {
            teamId: entityId,
            isActive: true,
          },
          select: {
            userId: true,
          },
        });
        participants = teamMembers.map((member) => ({ id: member.userId }));
        break;

      case 'PROJECT':
        // Add all project members
        const projectMembers = await prisma.projectMember.findMany({
          where: {
            projectId: entityId,
            isActive: true,
          },
          select: {
            userId: true,
          },
        });
        participants = projectMembers.map((member) => ({ id: member.userId }));
        break;

      case 'TASK':
        // Add task creator and assignee
        const task = await prisma.task.findUnique({
          where: { id: entityId },
          select: {
            createdBy: true,
            assignedTo: true,
            projectId: true,
          },
        });

        if (task) {
          // Add task creator
          participants.push({ id: task.createdBy });

          // Add task assignee if exists
          if (task.assignedTo) {
            participants.push({ id: task.assignedTo });
          }

          // Add project manager
          const project = await prisma.project.findUnique({
            where: { id: task.projectId },
            select: { createdBy: true },
          });

          if (project) {
            participants.push({ id: project.createdBy });
          }
        }
        break;

      default:
        break;
    }

    // Create participant records for all users
    // Filter out duplicates and the creator (who is already added)
    const uniqueParticipantIds = [
      ...new Set(participants.map((p) => p.id)),
    ].filter((id) => id !== userId);

    if (uniqueParticipantIds.length > 0) {
      await prisma.chatParticipant.createMany({
        data: uniqueParticipantIds.map((participantId) => ({
          chatRoomId: chatRoom.id,
          userId: participantId,
          isAdmin: false,
        })),
        skipDuplicates: true,
      });
    }

    // Create welcome system message
    await prisma.chatMessage.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: userId,
        content: `Welcome to ${chatRoom.name}!`,
        contentType: 'SYSTEM',
        metadata: {
          action: 'room_created',
        },
      },
    });

    // Return the created chat room
    const createdRoom = await prisma.chatRoom.findUnique({
      where: { id: chatRoom.id },
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

    return res.status(201).json({
      success: true,
      data: createdRoom,
    });
  } catch (error) {
    // console.error('Error creating chat room:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create chat room',
      error: error.message,
    });
  }
};

/**
 * Get all chat rooms for a user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getUserChatRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all chat rooms where the user is a participant
    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        participants: {
          some: {
            userId,
            status: 'ACTIVE',
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

    return res.status(200).json({
      success: true,
      data: chatRooms,
    });
  } catch (error) {
    // console.error('Error getting user chat rooms:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user chat rooms',
      error: error.message,
    });
  }
};

/**
 * Get a specific chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getChatRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if the user is a participant in this chat room
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        id,
        isActive: true,
        participants: {
          some: {
            userId,
            status: 'ACTIVE',
          },
        },
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
      },
    });

    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found or you do not have access',
      });
    }

    return res.status(200).json({
      success: true,
      data: chatRoom,
    });
  } catch (error) {
    // console.error('Error getting chat room:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat room',
      error: error.message,
    });
  }
};

/**
 * Get messages for a chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getChatMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 50, before } = req.query;

    // Check if the user is a participant in this chat room
    const isParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this chat room',
      });
    }

    // Query conditions
    const whereConditions = {
      chatRoomId: id,
    };

    // Add pagination condition if 'before' parameter is provided
    if (before) {
      whereConditions.createdAt = {
        lt: new Date(before),
      };
    }

    // Get messages with pagination
    const messages = await prisma.chatMessage.findMany({
      where: whereConditions,
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
        attachments: true,
        reactions: {
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
        pinnedIn: {
          select: {
            id: true,
            pinnedBy: true,
            pinnedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit),
    });

    // Update user's last read message
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
      success: true,
      data: messages.reverse(), // Return in chronological order
    });
  } catch (error) {
    // console.error('Error getting chat messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat messages',
      error: error.message,
    });
  }
};

/**
 * Add a participant to a chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user.id;

    // Check if the current user is an admin in this chat room
    const currentUserParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId: currentUserId,
        },
      },
    });

    if (!currentUserParticipant || !currentUserParticipant.isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to add participants to this chat room',
      });
    }

    // Check if the user to add exists
    const userToAdd = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    // Check if the user is already a participant
    const existingParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (existingParticipant) {
      // If participant exists but was previously removed, reactivate them
      if (existingParticipant.status !== 'ACTIVE') {
        await prisma.chatParticipant.update({
          where: { id: existingParticipant.id },
          data: { status: 'ACTIVE' },
        });

        // Create system message about user rejoining
        await prisma.chatMessage.create({
          data: {
            chatRoomId: id,
            senderId: currentUserId,
            content: `${userToAdd.firstName} ${userToAdd.lastName} was added back to the chat`,
            contentType: 'SYSTEM',
            metadata: {
              action: 'user_readded',
              targetUserId: userId,
            },
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'User is already an active participant in this chat room',
        });
      }
    } else {
      // Add new participant
      await prisma.chatParticipant.create({
        data: {
          chatRoomId: id,
          userId,
          isAdmin: false, // New participants are not admins by default
        },
      });

      // Create system message about new user
      await prisma.chatMessage.create({
        data: {
          chatRoomId: id,
          senderId: currentUserId,
          content: `${userToAdd.firstName} ${userToAdd.lastName} was added to the chat`,
          contentType: 'SYSTEM',
          metadata: {
            action: 'user_added',
            targetUserId: userId,
          },
        },
      });
    }

    // Get updated participant list
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id },
      include: {
        participants: {
          where: { status: 'ACTIVE' },
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

    // Notify chat room about the new participant
    emitToRoom(`chat:${id}`, 'chat:participant-added', {
      chatRoomId: id,
      participant: {
        userId,
        username: userToAdd.username,
        firstName: userToAdd.firstName,
        lastName: userToAdd.lastName,
      },
      addedBy: {
        id: currentUserId,
        username: req.user.username,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Participant added successfully',
      data: chatRoom,
    });
  } catch (error) {
    // console.error('Error adding participant:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add participant',
      error: error.message,
    });
  }
};

/**
 * Remove a participant from a chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const removeParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const currentUserId = req.user.id;

    // Check if the current user is an admin or the participant being removed is self
    const currentUserParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId: currentUserId,
        },
      },
    });

    const userToRemove = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    // User can remove themselves, or admins can remove others
    const isSelfRemoval = userId === currentUserId;
    if (
      !isSelfRemoval &&
      (!currentUserParticipant || !currentUserParticipant.isAdmin)
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to remove participants from this chat room',
      });
    }

    // Check if the participant to remove exists
    const participantToRemove = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (!participantToRemove) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found in this chat room',
      });
    }

    // Cannot remove the last admin
    if (participantToRemove.isAdmin) {
      const adminCount = await prisma.chatParticipant.count({
        where: {
          chatRoomId: id,
          isAdmin: true,
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the last admin from the chat room',
        });
      }
    }

    // Update participant status to LEFT instead of deleting
    await prisma.chatParticipant.update({
      where: { id: participantToRemove.id },
      data: { status: 'LEFT' },
    });

    // Create system message
    const action = isSelfRemoval ? 'user_left' : 'user_removed';
    const content = isSelfRemoval
      ? `${userToRemove.firstName} ${userToRemove.lastName} left the chat`
      : `${userToRemove.firstName} ${userToRemove.lastName} was removed from the chat`;

    await prisma.chatMessage.create({
      data: {
        chatRoomId: id,
        senderId: currentUserId,
        content,
        contentType: 'SYSTEM',
        metadata: {
          action,
          targetUserId: userId,
        },
      },
    });

    // Notify chat room about the removed participant
    emitToRoom(`chat:${id}`, 'chat:participant-removed', {
      chatRoomId: id,
      userId,
      removedBy: isSelfRemoval
        ? null
        : {
            id: currentUserId,
            username: req.user.username,
          },
    });

    return res.status(200).json({
      success: true,
      message: 'Participant removed successfully',
    });
  } catch (error) {
    // console.error('Error removing participant:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove participant',
      error: error.message,
    });
  }
};

/**
 * Pin a message in a chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const pinMessage = async (req, res) => {
  try {
    const { chatRoomId, messageId } = req.body;
    const userId = req.user.id;

    // Check if the user is a participant in this chat room
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this chat room',
      });
    }

    // Check if the message exists in this chat room
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        chatRoomId,
      },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found in this chat room',
      });
    }

    // Check if the message is already pinned
    const existingPin = await prisma.pinnedMessage.findUnique({
      where: {
        chatRoomId_messageId: {
          chatRoomId,
          messageId,
        },
      },
    });

    if (existingPin) {
      return res.status(400).json({
        success: false,
        message: 'This message is already pinned',
      });
    }

    // Create the pinned message
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

    // Notify chat room
    emitToRoom(`chat:${chatRoomId}`, 'chat:message-pinned', {
      chatRoomId,
      messageId,
      pinnedBy: {
        id: userId,
        username: req.user.username,
      },
      pinnedAt: pinnedMessage.pinnedAt,
    });

    return res.status(200).json({
      success: true,
      data: pinnedMessage,
    });
  } catch (error) {
    // console.error('Error pinning message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to pin message',
      error: error.message,
    });
  }
};

/**
 * Unpin a message from a chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const unpinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the pinned message
    const pinnedMessage = await prisma.pinnedMessage.findUnique({
      where: { id },
      include: {
        message: true,
      },
    });

    if (!pinnedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Pinned message not found',
      });
    }

    // Check if the user is an admin or the one who pinned the message
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: pinnedMessage.chatRoomId,
          userId,
        },
      },
    });

    if (
      !participant ||
      (!participant.isAdmin && pinnedMessage.pinnedBy !== userId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to unpin this message',
      });
    }

    // Delete the pinned message
    await prisma.pinnedMessage.delete({
      where: { id },
    });

    // Notify chat room
    emitToRoom(`chat:${pinnedMessage.chatRoomId}`, 'chat:message-unpinned', {
      chatRoomId: pinnedMessage.chatRoomId,
      messageId: pinnedMessage.messageId,
      unpinnedBy: {
        id: userId,
        username: req.user.username,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Message unpinned successfully',
    });
  } catch (error) {
    // console.error('Error unpinning message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unpin message',
      error: error.message,
    });
  }
};

/**
 * Get all pinned messages for a chat room
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getPinnedMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if the user is a participant in this chat room
    const isParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: id,
          userId,
        },
      },
    });

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this chat room',
      });
    }

    // Get all pinned messages
    const pinnedMessages = await prisma.pinnedMessage.findMany({
      where: { chatRoomId: id },
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

    return res.status(200).json({
      success: true,
      data: pinnedMessages,
    });
  } catch (error) {
    // console.error('Error getting pinned messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get pinned messages',
      error: error.message,
    });
  }
};

/**
 * Generate a chat room when a new entity is created
 * @param {string} entityType - Type of entity (ORGANIZATION, DEPARTMENT, TEAM, PROJECT, TASK)
 * @param {string} entityId - ID of the entity
 * @param {string} name - Name for the chat room
 * @param {string} description - Description for the chat room
 * @param {string} creatorId - ID of the user creating the entity
 * @returns {Promise<Object>} Created chat room
 */
export const generateChatRoom = async (
  entityType,
  entityId,
  name,
  description,
  creatorId,
) => {
  try {
    // Create the chat room
    const chatRoom = await prisma.chatRoom.create({
      data: {
        name: `${name} Chat`,
        description: description || `Chat room for ${name}`,
        type: entityType, // Chat type matches entity type
        entityType,
        entityId,
      },
    });

    // Add the creator as an admin participant
    await prisma.chatParticipant.create({
      data: {
        chatRoomId: chatRoom.id,
        userId: creatorId,
        isAdmin: true,
      },
    });

    // Add participants based on the entity type
    let participants = [];

    switch (entityType) {
      case 'ORGANIZATION':
        // Add all organization members
        participants = await prisma.user.findMany({
          where: {
            organizationId: entityId,
            isActive: true,
            id: { not: creatorId }, // Exclude creator who is already added
          },
          select: {
            id: true,
          },
        });
        break;

      case 'DEPARTMENT':
        // Add all department members
        participants = await prisma.user.findMany({
          where: {
            departmentId: entityId,
            isActive: true,
            id: { not: creatorId }, // Exclude creator who is already added
          },
          select: {
            id: true,
          },
        });
        break;

      case 'TEAM':
        // Add all team members
        const teamMembers = await prisma.teamMember.findMany({
          where: {
            teamId: entityId,
            isActive: true,
            userId: { not: creatorId }, // Exclude creator who is already added
          },
          select: {
            userId: true,
          },
        });
        participants = teamMembers.map((member) => ({ id: member.userId }));
        break;

      case 'PROJECT':
        // Add all project members
        const projectMembers = await prisma.projectMember.findMany({
          where: {
            projectId: entityId,
            isActive: true,
            userId: { not: creatorId }, // Exclude creator who is already added
          },
          select: {
            userId: true,
          },
        });
        participants = projectMembers.map((member) => ({ id: member.userId }));
        break;

      case 'TASK':
        // Add task creator and assignee
        const task = await prisma.task.findUnique({
          where: { id: entityId },
          select: {
            createdBy: true,
            assignedTo: true,
            projectId: true,
          },
        });

        if (task) {
          // Add assignee if exists and is not the creator
          if (task.assignedTo && task.assignedTo !== creatorId) {
            participants.push({ id: task.assignedTo });
          }

          // Add project manager if not the creator
          const project = await prisma.project.findUnique({
            where: { id: task.projectId },
            select: { createdBy: true },
          });

          if (project && project.createdBy !== creatorId) {
            participants.push({ id: project.createdBy });
          }
        }
        break;

      default:
        break;
    }

    // Create participant records for all users
    // Filter out duplicates
    const uniqueParticipantIds = [...new Set(participants.map((p) => p.id))];

    if (uniqueParticipantIds.length > 0) {
      await prisma.chatParticipant.createMany({
        data: uniqueParticipantIds.map((participantId) => ({
          chatRoomId: chatRoom.id,
          userId: participantId,
          isAdmin: false,
        })),
        skipDuplicates: true,
      });
    }

    // Create welcome system message
    await prisma.chatMessage.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: creatorId,
        content: `Welcome to ${chatRoom.name}!`,
        contentType: 'SYSTEM',
        metadata: {
          action: 'room_created',
        },
      },
    });

    // console.log(`Chat room created for ${entityType} ${entityId}`);
    return chatRoom;
  } catch (error) {
    /* eslint no-useless-catch: off */
    throw error;
  }
};
