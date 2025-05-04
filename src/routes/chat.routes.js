// src/routes/chat.routes.js
import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  addParticipants,
  createChatRoom,
  getChatRoomById,
  getChatRooms,
  getMessages,
  getPinnedMessages,
  makeAdmin,
  pinMessage,
  removeAdmin,
  removeParticipant,
  unpinMessage,
  updateChatRoom,
} from '../controllers/chat.controller.js';

const router = Router();

// Apply auth middleware to all chat routes
router.use(verifyAccessToken);

// Chat room routes
router.post('/api/chat', createChatRoom);
router.get('/api/chat', getChatRooms);
router.get('/api/chat/:id', getChatRoomById);
router.put('/api/chat/:id', updateChatRoom);
router.get('/api/chat/:id/messages', getMessages);

// Participant management
router.post('/api/chat/:id/participants', addParticipants);
router.delete('/api/chat/:id/participants/:userId', removeParticipant);
router.put('/api/chat/:id/admins/:userId', makeAdmin);
router.delete('/api/chat/:id/admins/:userId', removeAdmin);

// Pinned messages
router.post('/api/chat/:chatRoomId/pin/:messageId', pinMessage);
router.delete('/api/chat/:chatRoomId/pin/:messageId', unpinMessage);
router.get('/api/chat/:id/pinned', getPinnedMessages);

export default router;
