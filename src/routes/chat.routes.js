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
router.post('/', createChatRoom);
router.get('/', getChatRooms);
router.get('/:id', getChatRoomById);
router.put('/:id', updateChatRoom);
router.get('/:id/messages', getMessages);

// Participant management
router.post('/:id/participants', addParticipants);
router.delete('/:id/participants/:userId', removeParticipant);
router.put('/:id/admins/:userId', makeAdmin);
router.delete('/:id/admins/:userId', removeAdmin);

// Pinned messages
router.post('/:chatRoomId/pin/:messageId', pinMessage);
router.delete('/:chatRoomId/pin/:messageId', unpinMessage);
router.get('/:id/pinned', getPinnedMessages);

export default router;
