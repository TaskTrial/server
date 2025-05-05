// src/routes/videoConference.routes.js
import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  createVideoSession,
  getChatRoomSessions,
  getVideoSession,
  updateVideoSession,
  joinVideoSession,
  leaveVideoSession,
  changeParticipantRole,
  startRecording,
  stopRecording,
  getSessionRecordings,
  updateRecordingVisibility,
} from '../controllers/videoConference.controller.js';

const router = Router();

// Apply auth middleware to all video routes
router.use(verifyAccessToken);

// Session management
router.post('/api/video/sessions', createVideoSession);
router.get('/api/video/chat/:chatRoomId/sessions', getChatRoomSessions);
router.get('/api/video/sessions/:id', getVideoSession);
router.put('/api/video/sessions/:id', updateVideoSession);

// Participant management
router.post('/api/video/sessions/:id/join', joinVideoSession);
router.post('/api/video/sessions/:id/leave', leaveVideoSession);
router.put(
  '/api/video/sessions/:id/participants/:participantId/role',
  changeParticipantRole,
);

// Recording management
router.post('/api/video/sessions/:id/recordings', startRecording);
router.put('/api/video/recordings/:recordingId/stop', stopRecording);
router.get('/api/video/sessions/:id/recordings', getSessionRecordings);
router.put('/api/video/recordings/:id/visibility', updateRecordingVisibility);

export default router;
