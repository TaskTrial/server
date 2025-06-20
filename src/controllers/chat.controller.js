// import prisma from '../config/prismaClient.js';
// import {
//   createChatRoomValidation,
//   updateChatRoomValidation,
//   addParticipantsValidation,
// } from '../validations/chat.validation.js';
// import {
//   chatRoomCache,
//   // chatMessagesCache,
//   chatParticipantsCache,
// } from '../utils/chatCache.utils.js';
// import { ApiError } from '../utils/errorCodes.utils.js';
// /* eslint no-console: off */

// /**
//  * @desc   Creates a new chat room
//  * @route  /api/chat
//  * @method POST
//  * @access private
//  */
// export const createChatRoom = async (req, res) => {
//   try {
//     // Validate request body
//     const { error } = createChatRoomValidation(req.body);

//     if (error) {
//       return res
//         .status(400)
//         .json(
//           ApiError.validationError(
//             error.details.map((detail) => detail.message),
//           ),
//         );
//     }

//     const { name, description, type, entityType, entityId } = req.body;
//     const userId = req.user.id;

//     // Verify entity exists
//     const entity = await verifyEntity(entityType, entityId);
//     if (!entity) {
//       return res.status(404).json(ApiError.notFound(entityType, entityId));
//     }

//     // Check if chat room already exists for this entity
//     const existingChatRoom = await prisma.chatRoom.findUnique({
//       where: {
//         entityType_entityId: {
//           entityType,
//           entityId,
//         },
//       },
//     });

//     if (existingChatRoom) {
//       return res
//         .status(409)
//         .json(
//           ApiError.conflict(`Chat room already exists for this ${entityType}`),
//         );
//     }

//     // Create new chat room
//     const chatRoom = await prisma.chatRoom.create({
//       data: {
//         name: name || `${entityType} Chat`,
//         description,
//         type,
//         entityType,
//         entityId,
//         lastMessageAt: new Date(),
//       },
//     });

//     // Add the current user as a participant and admin
//     await prisma.chatParticipant.create({
//       data: {
//         chatRoomId: chatRoom.id,
//         userId,
//         isAdmin: true,
//       },
//     });

//     // Invalidate user's chat rooms cache
//     await chatRoomCache.deleteUserRooms(userId);

//     return res.status(201).json(chatRoom);
//   } catch (error) {
//     console.error('Error creating chat room:', error);
//     return res
//       .status(500)
//       .json(ApiError.serverError('Failed to create chat room', error));
//   }
// };

// /**
//  * @desc   Creates all chat rooms
//  * @route  /api/chat
//  * @method GET
//  * @access private
//  */
// export const getChatRooms = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // Try to get from cache first
//     const cachedRooms = await chatRoomCache.getUserRooms(userId);
//     if (cachedRooms) {
//       return res.status(200).json(cachedRooms);
//     }

//     // If not in cache, fetch from database
//     const chatRooms = await prisma.chatRoom.findMany({
//       where: {
//         participants: {
//           some: {
//             userId,
//           },
//         },
//         isActive: true,
//       },
//       include: {
//         participants: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//                 profilePic: true,
//               },
//             },
//           },
//         },
//         messages: {
//           orderBy: {
//             createdAt: 'desc',
//           },
//           take: 1,
//           select: {
//             id: true,
//             content: true,
//             contentType: true,
//             createdAt: true,
//             sender: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//               },
//             },
//           },
//         },
//         _count: {
//           select: {
//             messages: true,
//           },
//         },
//       },
//       orderBy: {
//         lastMessageAt: 'desc',
//       },
//     });

//     // Get unread message counts for each chat room
//     const chatRoomsWithUnread = await Promise.all(
//       chatRooms.map(async (room) => {
//         const participant = room.participants.find((p) => p.userId === userId);

//         const unreadCount = await prisma.chatMessage.count({
//           where: {
//             chatRoomId: room.id,
//             createdAt: {
//               gt: participant.lastReadAt || new Date(0),
//             },
//             senderId: {
//               not: userId,
//             },
//           },
//         });

//         return {
//           ...room,
//           unreadCount,
//         };
//       }),
//     );

//     // Store in cache for future requests
//     await chatRoomCache.setUserRooms(userId, chatRoomsWithUnread);

//     return res.status(200).json(chatRoomsWithUnread);
//   } catch (error) {
//     console.error('Error fetching chat rooms:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to fetch chat rooms', error: error.message });
//   }
// };

// /**
//  * @desc   Get a chat room by id
//  * @route  /api/chat/:id
//  * @method GET
//  * @access private
//  */
// export const getChatRoomById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     // Check if user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     const chatRoom = await prisma.chatRoom.findUnique({
//       where: { id },
//       include: {
//         participants: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//                 profilePic: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!chatRoom) {
//       return res.status(404).json({ message: 'Chat room not found' });
//     }

//     return res.status(200).json(chatRoom);
//   } catch (error) {
//     console.error('Error fetching chat room:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to fetch chat room', error: error.message });
//   }
// };

// /**
//  * @desc   Get a chat room by id
//  * @route  /api/chat/:id
//  * @method PUT
//  * @access private
//  */
// export const updateChatRoom = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Validate request body
//     const { error } = updateChatRoomValidation(req.body);

//     if (error) {
//       return res.status(400).json({
//         message: 'Validation failed',
//         errors: error.details.map((detail) => detail.message),
//       });
//     }

//     const { name, description, isArchived } = req.body;
//     const userId = req.user.id;

//     // Check if user is an admin participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant || !participant.isAdmin) {
//       return res.status(403).json({
//         message: 'You do not have permission to update this chat room',
//       });
//     }

//     const updatedData = {
//       ...(name && { name }),
//       ...(description !== undefined && { description }),
//       ...(isArchived !== undefined && {
//         isArchived,
//         ...(isArchived && { archivedAt: new Date() }),
//       }),
//       updatedAt: new Date(),
//     };

//     const chatRoom = await prisma.chatRoom.update({
//       where: { id },
//       data: updatedData,
//     });

//     return res.status(200).json(chatRoom);
//   } catch (error) {
//     console.error('Error updating chat room:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to update chat room', error: error.message });
//   }
// };

// /**
//  * @desc   Get all messages in specific chat room
//  * @route  /api/chat/:id/messages
//  * @method GET
//  * @access private
//  */
// export const getMessages = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;
//     const { page = 1, limit = 20 } = req.query;

//     const pageNumber = parseInt(page);
//     const limitNumber = parseInt(limit);
//     const skip = (pageNumber - 1) * limitNumber;

//     // Check if user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     // Try to get from cache first
//     const cachedMessages = await chatMessagesCache.get(
//       id,
//       pageNumber,
//       limitNumber,
//     );
//     if (cachedMessages) {
//       // Even if we have cached messages, update the read status
//       if (cachedMessages.messages.length > 0) {
//         await prisma.chatParticipant.update({
//           where: {
//             chatRoomId_userId: {
//               chatRoomId: id,
//               userId,
//             },
//           },
//           data: {
//             lastReadMessageId: cachedMessages.messages[0].id,
//             lastReadAt: new Date(),
//           },
//         });
//       }

//       return res.status(200).json(cachedMessages);
//     }

//     // Get messages with pagination
//     const messages = await prisma.chatMessage.findMany({
//       where: {
//         chatRoomId: id,
//         isDeleted: false,
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//       skip,
//       take: limitNumber,
//       include: {
//         sender: {
//           select: {
//             id: true,
//             username: true,
//             firstName: true,
//             lastName: true,
//             profilePic: true,
//           },
//         },
//         reactions: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//               },
//             },
//           },
//         },
//         attachments: true,
//         replyTo: {
//           select: {
//             id: true,
//             content: true,
//             sender: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     const total = await prisma.chatMessage.count({
//       where: {
//         chatRoomId: id,
//         isDeleted: false,
//       },
//     });

//     // Update last read status for the user
//     if (messages.length > 0) {
//       await prisma.chatParticipant.update({
//         where: {
//           chatRoomId_userId: {
//             chatRoomId: id,
//             userId,
//           },
//         },
//         data: {
//           lastReadMessageId: messages[0].id,
//           lastReadAt: new Date(),
//         },
//       });
//     }

//     const result = {
//       messages,
//       pagination: {
//         total,
//         page: pageNumber,
//         limit: limitNumber,
//         pages: Math.ceil(total / limitNumber),
//       },
//     };

//     // Store in cache for future requests
//     await chatMessagesCache.set(id, pageNumber, limitNumber, result);

//     return res.status(200).json(result);
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to fetch messages', error: error.message });
//   }
// };

// /**
//  * @desc   Add new participants
//  * @route  /api/chat/:id/participants
//  * @method POST
//  * @access private
//  */
// export const addParticipants = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Validate request body
//     const { error } = addParticipantsValidation(req.body);

//     if (error) {
//       return res.status(400).json({
//         message: 'Validation failed',
//         errors: error.details.map((detail) => detail.message),
//       });
//     }

//     const { userIds } = req.body; // Array of user IDs to add
//     const requestingUserId = req.user.id;

//     // Check if requesting user is an admin
//     const requestingParticipant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId: requestingUserId,
//         },
//       },
//     });

//     if (!requestingParticipant || !requestingParticipant.isAdmin) {
//       return res.status(403).json({
//         message:
//           'You do not have permission to add participants to this chat room',
//       });
//     }

//     // Get current participants to avoid duplicates
//     const currentParticipants = await prisma.chatParticipant.findMany({
//       where: {
//         chatRoomId: id,
//       },
//       select: {
//         userId: true,
//       },
//     });

//     const currentParticipantIds = currentParticipants.map((p) => p.userId);
//     const newParticipantIds = userIds.filter(
//       (userId) => !currentParticipantIds.includes(userId),
//     );

//     if (newParticipantIds.length === 0) {
//       return res.status(400).json({
//         message: 'All users are already participants in this chat room',
//       });
//     }

//     // Add new participants
//     const newParticipants = await prisma.$transaction(
//       newParticipantIds.map((userId) =>
//         prisma.chatParticipant.create({
//           data: {
//             chatRoomId: id,
//             userId,
//             isAdmin: false,
//           },
//         }),
//       ),
//     );

//     // Create a system message about new participants
//     const newUsernames = await prisma.user.findMany({
//       where: {
//         id: {
//           in: newParticipantIds,
//         },
//       },
//       select: {
//         firstName: true,
//         lastName: true,
//       },
//     });

//     const newUserNamesList = newUsernames
//       .map((u) => `${u.firstName} ${u.lastName}`)
//       .join(', ');

//     await prisma.chatMessage.create({
//       data: {
//         chatRoomId: id,
//         senderId: requestingUserId,
//         content: `Added ${newUserNamesList} to the chat`,
//         contentType: 'SYSTEM',
//       },
//     });

//     // Update last message timestamp
//     await prisma.chatRoom.update({
//       where: { id },
//       data: {
//         lastMessageAt: new Date(),
//       },
//     });

//     return res.status(200).json({ addedParticipants: newParticipants.length });
//   } catch (error) {
//     console.error('Error adding participants:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to add participants', error: error.message });
//   }
// };

// /**
//  * @desc   Add new participants
//  * @route  /api/chat/:id/participants/:userId
//  * @method DELETE
//  * @access private
//  */
// export const removeParticipant = async (req, res) => {
//   try {
//     const { id, userId } = req.params;
//     const requestingUserId = req.user.id;

//     // Check if requesting user is an admin or the user themselves
//     const requestingParticipant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId: requestingUserId,
//         },
//       },
//     });

//     if (!requestingParticipant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     // Only admins can remove others, but users can remove themselves
//     if (requestingUserId !== userId && !requestingParticipant.isAdmin) {
//       return res.status(403).json({
//         message: 'You do not have permission to remove this participant',
//       });
//     }

//     // Get the user being removed
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { firstName: true, lastName: true },
//     });

//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Remove the participant
//     await prisma.chatParticipant.delete({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     // Add system message if someone is removed (not if they leave)
//     if (requestingUserId !== userId) {
//       await prisma.chatMessage.create({
//         data: {
//           chatRoomId: id,
//           senderId: requestingUserId,
//           content: `Removed ${user.firstName} ${user.lastName} from the chat`,
//           contentType: 'SYSTEM',
//         },
//       });
//     } else {
//       await prisma.chatMessage.create({
//         data: {
//           chatRoomId: id,
//           senderId: requestingUserId,
//           content: `${user.firstName} ${user.lastName} left the chat`,
//           contentType: 'SYSTEM',
//         },
//       });
//     }

//     // Update last message timestamp
//     await prisma.chatRoom.update({
//       where: { id },
//       data: {
//         lastMessageAt: new Date(),
//       },
//     });

//     return res
//       .status(200)
//       .json({ message: 'Participant removed successfully' });
//   } catch (error) {
//     console.error('Error removing participant:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to remove participant', error: error.message });
//   }
// };

// /**
//  * @desc   Make user admin in chat room
//  * @route  /api/chat/:id/admins/:userId
//  * @method PUT
//  * @access private
//  */
// export const makeAdmin = async (req, res) => {
//   try {
//     const { id, userId } = req.params;
//     const requestingUserId = req.user.id;

//     // Check if requesting user is an admin
//     const requestingParticipant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId: requestingUserId,
//         },
//       },
//     });

//     if (!requestingParticipant || !requestingParticipant.isAdmin) {
//       return res.status(403).json({
//         message:
//           'You do not have permission to manage admins in this chat room',
//       });
//     }

//     // Update participant to admin
//     await prisma.chatParticipant.update({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//       data: {
//         isAdmin: true,
//       },
//     });

//     // Get the user who was made admin
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { firstName: true, lastName: true },
//     });

//     // Create system message
//     await prisma.chatMessage.create({
//       data: {
//         chatRoomId: id,
//         senderId: requestingUserId,
//         content: `${user.firstName} ${user.lastName} is now an admin`,
//         contentType: 'SYSTEM',
//       },
//     });

//     // Update last message timestamp
//     await prisma.chatRoom.update({
//       where: { id },
//       data: {
//         lastMessageAt: new Date(),
//       },
//     });

//     return res.status(200).json({ message: 'User is now an admin' });
//   } catch (error) {
//     console.error('Error making admin:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to update admin status', error: error.message });
//   }
// };

// /**
//  * @desc   Delete user admin status from chat room
//  * @route  /api/chat/:id/admins/:userId
//  * @method DELETE
//  * @access private
//  */
// export const removeAdmin = async (req, res) => {
//   try {
//     const { id, userId } = req.params;
//     const requestingUserId = req.user.id;

//     // Check if requesting user is an admin
//     const requestingParticipant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId: requestingUserId,
//         },
//       },
//     });

//     if (!requestingParticipant || !requestingParticipant.isAdmin) {
//       return res.status(403).json({
//         message:
//           'You do not have permission to manage admins in this chat room',
//       });
//     }

//     // Count admins to ensure at least one admin remains
//     const adminCount = await prisma.chatParticipant.count({
//       where: {
//         chatRoomId: id,
//         isAdmin: true,
//       },
//     });

//     if (adminCount <= 1 && userId === requestingUserId) {
//       return res
//         .status(400)
//         .json({ message: 'Cannot remove the last admin from the chat room' });
//     }

//     // Update participant to remove admin status
//     await prisma.chatParticipant.update({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//       data: {
//         isAdmin: false,
//       },
//     });

//     // Get the user who was removed as admin
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { firstName: true, lastName: true },
//     });

//     // Create system message
//     await prisma.chatMessage.create({
//       data: {
//         chatRoomId: id,
//         senderId: requestingUserId,
//         content: `${user.firstName} ${user.lastName} is no longer an admin`,
//         contentType: 'SYSTEM',
//       },
//     });

//     // Update last message timestamp
//     await prisma.chatRoom.update({
//       where: { id },
//       data: {
//         lastMessageAt: new Date(),
//       },
//     });

//     return res.status(200).json({ message: 'Admin status removed' });
//   } catch (error) {
//     console.error('Error removing admin status:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to update admin status', error: error.message });
//   }
// };

// /**
//  * @desc   Pin message in chat room
//  * @route  /api/chat/:chatRoomId/pin/:messageId
//  * @method POST
//  * @access private
//  */
// export const pinMessage = async (req, res) => {
//   try {
//     const { chatRoomId, messageId } = req.params;
//     const userId = req.user.id;

//     // Check if user is an admin
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId,
//           userId,
//         },
//       },
//     });

//     if (!participant || !participant.isAdmin) {
//       return res.status(403).json({
//         message: 'You do not have permission to pin messages in this chat room',
//       });
//     }

//     // Check if message exists and belongs to this chat room
//     const message = await prisma.chatMessage.findFirst({
//       where: {
//         id: messageId,
//         chatRoomId,
//       },
//     });

//     if (!message) {
//       return res
//         .status(404)
//         .json({ message: 'Message not found in this chat room' });
//     }

//     // Check if already pinned
//     const existingPin = await prisma.pinnedMessage.findUnique({
//       where: {
//         chatRoomId_messageId: {
//           chatRoomId,
//           messageId,
//         },
//       },
//     });

//     if (existingPin) {
//       return res.status(409).json({ message: 'Message is already pinned' });
//     }

//     // Pin the message
//     const pinnedMessage = await prisma.pinnedMessage.create({
//       data: {
//         chatRoomId,
//         messageId,
//         pinnedBy: userId,
//       },
//       include: {
//         message: {
//           include: {
//             sender: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     return res.status(201).json(pinnedMessage);
//   } catch (error) {
//     console.error('Error pinning message:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to pin message', error: error.message });
//   }
// };

// /**
//  * @desc   Unpin message in chat room
//  * @route  /api/chat/:chatRoomId/pin/:messageId
//  * @method DELETE
//  * @access private
//  */
// export const unpinMessage = async (req, res) => {
//   try {
//     const { chatRoomId, messageId } = req.params;
//     const userId = req.user.id;

//     // Check if user is an admin
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId,
//           userId,
//         },
//       },
//     });

//     if (!participant || !participant.isAdmin) {
//       return res.status(403).json({
//         message:
//           'You do not have permission to unpin messages in this chat room',
//       });
//     }

//     // Unpin the message
//     await prisma.pinnedMessage.delete({
//       where: {
//         chatRoomId_messageId: {
//           chatRoomId,
//           messageId,
//         },
//       },
//     });

//     return res.status(200).json({ message: 'Message unpinned successfully' });
//   } catch (error) {
//     console.error('Error unpinning message:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to unpin message', error: error.message });
//   }
// };

// /**
//  * @desc   Get pinned messages in chat room
//  * @route  /api/chat/:id/pinned
//  * @method GET
//  * @access private
//  */
// export const getPinnedMessages = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     // Check if user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     // Get pinned messages
//     const pinnedMessages = await prisma.pinnedMessage.findMany({
//       where: {
//         chatRoomId: id,
//       },
//       include: {
//         message: {
//           include: {
//             sender: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//                 profilePic: true,
//               },
//             },
//           },
//         },
//         user: {
//           select: {
//             id: true,
//             username: true,
//             firstName: true,
//             lastName: true,
//           },
//         },
//       },
//       orderBy: {
//         pinnedAt: 'desc',
//       },
//     });

//     return res.status(200).json(pinnedMessages);
//   } catch (error) {
//     console.error('Error fetching pinned messages:', error);
//     return res.status(500).json({
//       message: 'Failed to fetch pinned messages',
//       error: error.message,
//     });
//   }
// };

// /**
//  * @desc   Search for messages in a chat room
//  * @route  /api/chat/:id/search
//  * @method GET
//  * @access private
//  */
// export const searchMessages = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;
//     const { query, page = 1, limit = 20 } = req.query;

//     if (!query || query.trim().length < 2) {
//       return res
//         .status(400)
//         .json({ message: 'Search query must be at least 2 characters' });
//     }

//     const pageNumber = parseInt(page);
//     const limitNumber = parseInt(limit);
//     const skip = (pageNumber - 1) * limitNumber;

//     // Check if user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     // Search for messages containing the query
//     const messages = await prisma.chatMessage.findMany({
//       where: {
//         chatRoomId: id,
//         isDeleted: false,
//         content: {
//           contains: query,
//           mode: 'insensitive', // Case-insensitive search
//         },
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//       skip,
//       take: limitNumber,
//       include: {
//         sender: {
//           select: {
//             id: true,
//             username: true,
//             firstName: true,
//             lastName: true,
//             profilePic: true,
//           },
//         },
//         reactions: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//               },
//             },
//           },
//         },
//         attachments: true,
//         replyTo: {
//           select: {
//             id: true,
//             content: true,
//             sender: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     const total = await prisma.chatMessage.count({
//       where: {
//         chatRoomId: id,
//         isDeleted: false,
//         content: {
//           contains: query,
//           mode: 'insensitive',
//         },
//       },
//     });

//     return res.status(200).json({
//       messages,
//       query,
//       pagination: {
//         total,
//         page: pageNumber,
//         limit: limitNumber,
//         pages: Math.ceil(total / limitNumber),
//       },
//     });
//   } catch (error) {
//     console.error('Error searching messages:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to search messages', error: error.message });
//   }
// };

// // TODO: Message Reactions

// /**
//  * @desc   Upload attachments for a message
//  * @route  /api/chat/:id/messages/:messageId/attachments
//  * @method POST
//  * @access private
//  */
// export const uploadAttachments = async (req, res) => {
//   try {
//     const { id, messageId } = req.params;
//     const userId = req.user.id;
//     const files = req.files;

//     if (!files || files.length === 0) {
//       return res.status(400).json({ message: 'No files uploaded' });
//     }

//     // Check if user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     // Check if message exists and belongs to this user
//     const message = await prisma.chatMessage.findFirst({
//       where: {
//         id: messageId,
//         chatRoomId: id,
//         senderId: userId,
//       },
//     });

//     if (!message) {
//       return res
//         .status(404)
//         .json({ message: 'Message not found or you are not the sender' });
//     }

//     // Process and upload each file
//     const attachments = await Promise.all(
//       files.map(async (file) => {
//         // Upload file to cloudinary or other storage service
//         // For now, we'll use mock data
//         const uploadResult = {
//           url: `https://example.com/attachments/${file.filename}`,
//           fileType: file.mimetype,
//           fileSize: file.size,
//           fileName: file.originalname,
//         };

//         // Save attachment reference
//         return prisma.chatAttachment.create({
//           data: {
//             messageId,
//             fileUrl: uploadResult.url,
//             fileName: uploadResult.fileName,
//             fileType: uploadResult.fileType,
//             fileSize: uploadResult.fileSize,
//           },
//         });
//       }),
//     );

//     return res.status(201).json(attachments);
//   } catch (error) {
//     console.error('Error uploading attachments:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to upload attachments', error: error.message });
//   }
// };

// /**
//  * @desc   Delete an attachment
//  * @route  /api/chat/:id/attachments/:attachmentId
//  * @method DELETE
//  * @access private
//  */
// export const deleteAttachment = async (req, res) => {
//   try {
//     const { id, attachmentId } = req.params;
//     const userId = req.user.id;

//     // Verify user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     // Get the attachment with its message
//     const attachment = await prisma.chatAttachment.findUnique({
//       where: { id: attachmentId },
//       include: {
//         message: true,
//       },
//     });

//     if (!attachment) {
//       return res.status(404).json({ message: 'Attachment not found' });
//     }

//     // Verify the attachment belongs to a message in this chat room
//     if (attachment.message.chatRoomId !== id) {
//       return res
//         .status(403)
//         .json({ message: 'Attachment does not belong to this chat room' });
//     }

//     // Verify user is the message sender or an admin
//     if (attachment.message.senderId !== userId && !participant.isAdmin) {
//       return res.status(403).json({
//         message: 'You do not have permission to delete this attachment',
//       });
//     }

//     // Delete the attachment
//     await prisma.chatAttachment.delete({
//       where: { id: attachmentId },
//     });

//     // TODO: Delete file from storage service if needed

//     return res.status(200).json({ message: 'Attachment deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting attachment:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to delete attachment', error: error.message });
//   }
// };

// /**
//  * @desc   Get all attachments for a chat room
//  * @route  /api/chat/:id/attachments
//  * @method GET
//  * @access private
//  */
// export const getChatRoomAttachments = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;
//     const { type, page = 1, limit = 20 } = req.query;

//     const pageNumber = parseInt(page);
//     const limitNumber = parseInt(limit);
//     const skip = (pageNumber - 1) * limitNumber;

//     // Check if user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in this chat room' });
//     }

//     // Build query filters
//     const whereClause = {
//       message: {
//         chatRoomId: id,
//         isDeleted: false,
//       },
//       ...(type && { fileType: { contains: type } }),
//     };

//     // Get attachments with pagination
//     const attachments = await prisma.chatAttachment.findMany({
//       where: whereClause,
//       include: {
//         message: {
//           select: {
//             content: true,
//             contentType: true,
//             createdAt: true,
//             sender: {
//               select: {
//                 id: true,
//                 username: true,
//                 firstName: true,
//                 lastName: true,
//               },
//             },
//           },
//         },
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//       skip,
//       take: limitNumber,
//     });

//     const total = await prisma.chatAttachment.count({
//       where: whereClause,
//     });

//     return res.status(200).json({
//       attachments,
//       pagination: {
//         total,
//         page: pageNumber,
//         limit: limitNumber,
//         pages: Math.ceil(total / limitNumber),
//       },
//     });
//   } catch (error) {
//     console.error('Error fetching attachments:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to fetch attachments', error: error.message });
//   }
// };

// /**
//  * @desc   Forward a message to another chat room
//  * @route  /api/chat/:id/messages/:messageId/forward
//  * @method POST
//  * @access private
//  */
// export const forwardMessage = async (req, res) => {
//   try {
//     const { id, messageId } = req.params;
//     const { targetChatRoomIds } = req.body; // Array of chat room IDs to forward to
//     const userId = req.user.id;

//     if (!Array.isArray(targetChatRoomIds) || targetChatRoomIds.length === 0) {
//       return res
//         .status(400)
//         .json({ message: 'At least one target chat room ID is required' });
//     }

//     // Check if user is a participant in the source chat room
//     const sourceParticipant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!sourceParticipant) {
//       return res
//         .status(403)
//         .json({ message: 'You are not a participant in the source chat room' });
//     }

//     // Get the message to forward
//     const message = await prisma.chatMessage.findUnique({
//       where: {
//         id: messageId,
//         chatRoomId: id,
//       },
//       include: {
//         attachments: true,
//         sender: {
//           select: {
//             id: true,
//             username: true,
//             firstName: true,
//             lastName: true,
//           },
//         },
//       },
//     });

//     if (!message) {
//       return res.status(404).json({ message: 'Message not found' });
//     }

//     if (message.isDeleted) {
//       return res
//         .status(400)
//         .json({ message: 'Cannot forward a deleted message' });
//     }

//     // Check if user is a participant in all target chat rooms
//     const targetRoomsParticipations = await prisma.chatParticipant.findMany({
//       where: {
//         userId,
//         chatRoomId: {
//           in: targetChatRoomIds,
//         },
//       },
//       select: {
//         chatRoomId: true,
//       },
//     });

//     const accessibleTargetRoomIds = targetRoomsParticipations.map(
//       (p) => p.chatRoomId,
//     );
//     const inaccessibleRoomIds = targetChatRoomIds.filter(
//       (id) => !accessibleTargetRoomIds.includes(id),
//     );

//     if (inaccessibleRoomIds.length > 0) {
//       return res.status(403).json({
//         message: 'You are not a participant in some target chat rooms',
//         inaccessibleRoomIds,
//       });
//     }

//     // Forward the message to each target chat room
//     const forwardedMessages = await Promise.all(
//       accessibleTargetRoomIds.map(async (targetRoomId) => {
//         // Create the forwarded message
//         const forwardedMessage = await prisma.chatMessage.create({
//           data: {
//             chatRoomId: targetRoomId,
//             senderId: userId,
//             content: message.content,
//             contentType: message.contentType,
//             metadata: {
//               ...(message.metadata || {}),
//               forwarded: true,
//               originalMessageId: message.id,
//               originalSenderId: message.senderId,
//               originalSenderName: `${message.sender.firstName} ${message.sender.lastName}`,
//               forwardedAt: new Date().toISOString(),
//             },
//           },
//         });

//         // If the original message had attachments, copy them to the forwarded message
//         if (message.attachments && message.attachments.length > 0) {
//           await Promise.all(
//             message.attachments.map((attachment) =>
//               prisma.chatAttachment.create({
//                 data: {
//                   messageId: forwardedMessage.id,
//                   fileUrl: attachment.fileUrl,
//                   fileName: attachment.fileName,
//                   fileType: attachment.fileType,
//                   fileSize: attachment.fileSize,
//                 },
//               }),
//             ),
//           );
//         }

//         // Update the chat room's last message timestamp
//         await prisma.chatRoom.update({
//           where: { id: targetRoomId },
//           data: { lastMessageAt: new Date() },
//         });

//         return forwardedMessage;
//       }),
//     );

//     return res.status(200).json({
//       message: 'Message forwarded successfully',
//       forwardedCount: forwardedMessages.length,
//       forwardedMessages,
//     });
//   } catch (error) {
//     console.error('Error forwarding message:', error);
//     return res
//       .status(500)
//       .json({ message: 'Failed to forward message', error: error.message });
//   }
// };

// /**
//  * @desc   Get all participants in a chat room with pagination
//  * @route  /api/chat/:id/participants
//  * @method GET
//  * @access private
//  */
// export const getChatRoomParticipants = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;
//     const { page = 1, limit = 20, search } = req.query;

//     const pageNumber = parseInt(page);
//     const limitNumber = parseInt(limit);
//     const skip = (pageNumber - 1) * limitNumber;

//     // Check if user is a participant
//     const participant = await prisma.chatParticipant.findUnique({
//       where: {
//         chatRoomId_userId: {
//           chatRoomId: id,
//           userId,
//         },
//       },
//     });

//     if (!participant) {
//       return res.status(403).json(ApiError.notChatParticipant(id));
//     }

//     // Try to get from cache if no search query
//     if (!search) {
//       const cachedParticipants = await chatParticipantsCache.get(id);
//       if (cachedParticipants) {
//         // Apply pagination in memory
//         const total = cachedParticipants.length;
//         const paginatedParticipants = cachedParticipants.slice(
//           skip,
//           skip + limitNumber,
//         );

//         return res.status(200).json({
//           participants: paginatedParticipants,
//           pagination: {
//             total,
//             page: pageNumber,
//             limit: limitNumber,
//             pages: Math.ceil(total / limitNumber),
//           },
//         });
//       }
//     }

//     // Build query filters
//     const whereClause = {
//       chatRoomId: id,
//       user: search
//         ? {
//             OR: [
//               { firstName: { contains: search, mode: 'insensitive' } },
//               { lastName: { contains: search, mode: 'insensitive' } },
//               { username: { contains: search, mode: 'insensitive' } },
//               { email: { contains: search, mode: 'insensitive' } },
//             ],
//           }
//         : undefined,
//     };

//     // Get participants with pagination
//     const participants = await prisma.chatParticipant.findMany({
//       where: whereClause,
//       include: {
//         user: {
//           select: {
//             id: true,
//             username: true,
//             email: true,
//             firstName: true,
//             lastName: true,
//             profilePic: true,
//           },
//         },
//       },
//       orderBy: [
//         { isAdmin: 'desc' }, // Admins first
//         { user: { firstName: 'asc' } }, // Then by first name
//       ],
//       skip,
//       take: limitNumber,
//     });

//     const total = await prisma.chatParticipant.count({
//       where: whereClause,
//     });

//     const result = {
//       participants,
//       pagination: {
//         total,
//         page: pageNumber,
//         limit: limitNumber,
//         pages: Math.ceil(total / limitNumber),
//       },
//     };

//     // Cache the results if not a search query
//     if (!search) {
//       // Cache all participants without pagination for future requests
//       const allParticipants = await prisma.chatParticipant.findMany({
//         where: { chatRoomId: id },
//         include: {
//           user: {
//             select: {
//               id: true,
//               username: true,
//               email: true,
//               firstName: true,
//               lastName: true,
//               profilePic: true,
//             },
//           },
//         },
//         orderBy: [{ isAdmin: 'desc' }, { user: { firstName: 'asc' } }],
//       });

//       await chatParticipantsCache.set(id, allParticipants);
//     }

//     return res.status(200).json(result);
//   } catch (error) {
//     console.error('Error fetching participants:', error);
//     return res
//       .status(500)
//       .json(ApiError.serverError('Failed to fetch participants', error));
//   }
// };

// // Helper function to verify entity exists
// const verifyEntity = async (entityType, entityId) => {
//   switch (entityType) {
//     case 'ORGANIZATION':
//       return await prisma.organization.findUnique({
//         where: { id: entityId, deletedAt: null },
//       });
//     case 'DEPARTMENT':
//       return await prisma.department.findUnique({
//         where: { id: entityId, deletedAt: null },
//       });
//     case 'TEAM':
//       return await prisma.team.findUnique({
//         where: { id: entityId, deletedAt: null },
//       });
//     case 'PROJECT':
//       return await prisma.project.findUnique({
//         where: { id: entityId, deletedAt: null },
//       });
//     case 'TASK':
//       return await prisma.task.findUnique({
//         where: { id: entityId, deletedAt: null },
//       });
//     default:
//       return null;
//   }
// };
