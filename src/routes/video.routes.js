import express from 'express';
import {
  createVideoSession,
  getVideoSession,
  joinVideoSession,
  leaveVideoSession,
  endVideoSession,
  getUserVideoSessions,
  startRecording,
  stopRecording,
} from '../controllers/video.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// Video routes
router.post('/api/video/sessions', createVideoSession);
router.get('/api/video/sessions/:id', getVideoSession);
router.post('/api/video/sessions/:id/join', joinVideoSession);
router.post('/api/video/sessions/:id/leave', leaveVideoSession);
router.post('/api/video/sessions/:id/end', endVideoSession);
router.get('/api/video/sessions', getUserVideoSessions);
router.post('/api/video/sessions/:id/recording', startRecording);
router.post(
  '/api/video/sessions/:sessionId/recording/:recordingId/stop',
  stopRecording,
);

export default router;
