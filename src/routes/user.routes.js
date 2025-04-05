import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  restoreUser,
  softDeleteUser,
  updateUserAccount,
  updateUserPassword,
} from '../controllers/user.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { verifyAdminPermission } from '../middlewares/verifyAdminPermission.middleware.js';
import { verifyUserPermission } from '../middlewares/verifyUserPermission.middleware.js';
// import{authorizeUser} from '../middlewares/auth.middleware.js';

const router = Router();

router.get(
  '/api/users/all',
  verifyAccessToken,
  verifyAdminPermission,
  getAllUsers,
);

router.get(
  '/api/users/:id',
  verifyAccessToken,
  verifyUserPermission,
  getUserById,
);

router.put(
  '/api/users/:id',
  verifyAccessToken,
  verifyUserPermission,
  updateUserAccount,
);

router.put(
  '/api/users/update-password/:id',
  verifyAccessToken,
  verifyUserPermission,
  updateUserPassword,
);

router.delete(
  '/users/:id',
  verifyAccessToken,
  verifyAdminPermission,
  softDeleteUser,
);
router.patch(
  '/users/restore/:id',
  verifyAccessToken,
  verifyAdminPermission,
  restoreUser,
);

export default router;
