import { Router } from 'express';
import {
  deleteUserProfilePic,
  getAllUsers,
  getUserById,
  restoreUser,
  softDeleteUser,
  updateUserAccount,
  updateUserPassword,
  uploadUserProfilePic,
} from '../controllers/user.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { verifyAdminPermission } from '../middlewares/verifyAdminPermission.middleware.js';
import { verifyUserPermission } from '../middlewares/verifyUserPermission.middleware.js';
import upload from '../middlewares/upload.middleware.js';
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

router.patch(
  '/api/users/update-password/:id',
  verifyAccessToken,
  verifyUserPermission,
  updateUserPassword,
);

router.delete(
  '/api/users/delete/:id',
  verifyAccessToken,
  verifyUserPermission,
  softDeleteUser,
);

router.patch(
  '/api/users/restore/:id',
  verifyAccessToken,
  verifyAdminPermission,
  restoreUser,
);

router.post(
  '/api/users/:id/profile-picture',
  upload.single('image'),
  verifyAccessToken,
  verifyUserPermission,
  uploadUserProfilePic,
);

router.delete(
  '/api/users/:id/profile-picture',
  verifyAccessToken,
  verifyUserPermission,
  deleteUserProfilePic,
);

export default router;
