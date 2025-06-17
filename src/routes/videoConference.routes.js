// src/routes/videoConference.routes.js
import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  admitParticipant,
  changeParticipantRole,
  createVideoSession,
  denyParticipant,
  getChatRoomSessions,
  getSessionRecordings,
  getVideoSession,
  joinVideoSession,
  leaveVideoSession,
  startRecording,
  stopRecording,
  updateRecordingVisibility,
  updateVideoSession,
} from '../controllers/videoConference.controller.js';
import { videoSessionCreationLimiter } from '../utils/apiLimiter.utils.js';

const router = Router();

// Apply auth middleware to all video routes
router.use(verifyAccessToken);

// Session management
router.post(
  '/api/video/sessions',
  videoSessionCreationLimiter,
  createVideoSession,
);
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

// Waiting room management
router.put(
  '/api/video/sessions/:id/participants/:participantId/admit',
  admitParticipant,
);
router.put(
  '/api/video/sessions/:id/participants/:participantId/deny',
  denyParticipant,
);

// Recording management
router.post('/api/video/sessions/:id/recordings', startRecording);
router.put('/api/video/recordings/:recordingId/stop', stopRecording);
router.get('/api/video/sessions/:id/recordings', getSessionRecordings);
router.put('/api/video/recordings/:id/visibility', updateRecordingVisibility);

export default router;
