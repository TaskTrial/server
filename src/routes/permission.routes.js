import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  canCreateChat,
  getUserManagedEntities,
} from '../controllers/permission.controller.js';

const router = Router();

// Apply auth middleware to all permission routes
router.use(verifyAccessToken);

// Permission routes
router.get('/api/permissions/chat/create', canCreateChat);
router.get('/api/permissions/managed-entities', getUserManagedEntities);

export default router;
