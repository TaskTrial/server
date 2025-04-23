import express from 'express';
import {
  createChatRoom,
  getUserChatRooms,
  getChatRoom,
  getChatMessages,
  addParticipant,
  removeParticipant,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
} from '../controllers/chat.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// Chat routes
router.post('/api/chat/rooms', createChatRoom);
router.get('/api/chat/rooms', getUserChatRooms);
router.get('/api/chat/rooms/:id', getChatRoom);
router.get('/api/chat/rooms/:id/messages', getChatMessages);
router.post('/api/chat/rooms/:id/participants', addParticipant);
router.delete('/api/chat/rooms/:id/participants/:userId', removeParticipant);
router.post('/api/chat/messages/pin', pinMessage);
router.delete('/api/chat/pinned/:id', unpinMessage);
router.get('/api/chat/rooms/:id/pinned', getPinnedMessages);

export default router;
