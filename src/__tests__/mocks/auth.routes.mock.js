// Mock auth routes for testing
import express from 'express';
import * as authController from '../../controllers/auth.controller.js';

const router = express.Router();

// Auth routes
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/verifyEmail', authController.verifyEmail);
router.post('/resendOTP', authController.resendOTP);
router.post('/forgotPassword', authController.forgotPassword);
router.post('/resetPassword', authController.resetPassword);
router.post('/refreshAccessToken', authController.refreshAccessToken);
router.post('/logout', authController.logout);
router.post('/google', authController.googleOAuthLogin);
router.post('/firebase', authController.firebaseLogin);

export default router;
