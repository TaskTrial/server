// src/routes/chat.routes.js
import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  verifyChatParticipant,
  verifyChatAdmin,
  verifyMessageOwnership,
} from '../middlewares/chatPermission.middleware.js';
import {
  addParticipants,
  createChatRoom,
  deleteAttachment,
  forwardMessage,
  getChatRoomAttachments,
  getChatRoomById,
  getChatRoomParticipants,
  getChatRooms,
  getMessages,
  getPinnedMessages,
  makeAdmin,
  pinMessage,
  removeAdmin,
  removeParticipant,
  searchMessages,
  unpinMessage,
  updateChatRoom,
  uploadAttachments,
} from '../controllers/chat.controller.js';
import {
  chatMessageLimiter,
  chatRoomCreationLimiter,
} from '../utils/apiLimiter.utils.js';

const router = Router();

// Apply auth middleware to all chat routes
router.use(verifyAccessToken);

// Chat room routes
router.post('/api/chat', chatRoomCreationLimiter, createChatRoom);
router.get('/api/chat', getChatRooms);
router.get('/api/chat/:id', verifyChatParticipant, getChatRoomById);
router.put('/api/chat/:id', verifyChatAdmin, updateChatRoom);
router.get('/api/chat/:id/messages', verifyChatParticipant, getMessages);
router.get('/api/chat/:id/search', verifyChatParticipant, searchMessages);
router.post(
  '/api/chat/:id/messages/:messageId/forward',
  chatMessageLimiter,
  verifyChatParticipant,
  forwardMessage,
);

// Participant management
router.post('/api/chat/:id/participants', verifyChatAdmin, addParticipants);
router.get(
  '/api/chat/:id/participants',
  verifyChatParticipant,
  getChatRoomParticipants,
);
router.delete(
  '/api/chat/:id/participants/:userId',
  verifyChatAdmin,
  removeParticipant,
);
router.put('/api/chat/:id/admins/:userId', verifyChatAdmin, makeAdmin);
router.delete('/api/chat/:id/admins/:userId', verifyChatAdmin, removeAdmin);

// Pinned messages
router.post(
  '/api/chat/:chatRoomId/pin/:messageId',
  verifyChatAdmin,
  pinMessage,
);
router.delete(
  '/api/chat/:chatRoomId/pin/:messageId',
  verifyChatAdmin,
  unpinMessage,
);
router.get('/api/chat/:id/pinned', verifyChatParticipant, getPinnedMessages);

// Attachments
router.post(
  '/api/chat/:id/messages/:messageId/attachments',
  chatMessageLimiter,
  verifyMessageOwnership,
  uploadAttachments,
);
router.delete(
  '/api/chat/:id/attachments/:attachmentId',
  verifyMessageOwnership,
  deleteAttachment,
);
router.get(
  '/api/chat/:id/attachments',
  verifyChatParticipant,
  getChatRoomAttachments,
);

export default router;
