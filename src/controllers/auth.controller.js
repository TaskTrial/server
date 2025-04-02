import * as dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import { comparePassword, hashPassword } from '../utils/password.utils.js';
import { generateOTP } from '../utils/otp.utils.js';
import { sendEmail } from '../utils/email.utils.js';
import {
  forgotPasswordValidation,
  resetPasswordValidation,
  signinValidation,
  signupValidation,
  verifyEmailValidation,
} from '../validations/auth.validations.js';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../utils/token.utils.js';
import { googleVerifyIdToken } from '../utils/googleVerifyToken.utils.js';

/* eslint no-undef:off */
/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
export const signup = async (req, res, next) => {
  try {
    const { error } = signupValidation(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, firstName, lastName, username } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        username,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email or username already exists',
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate email verification OTP
    const verificationOTP = generateOTP();
    // TODO: hash otp when you save it in the db
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        password: hashedPassword,
        role: 'MEMBER', // Default role
        isActive: false, // Require email verification
        emailVerificationToken: verificationOTP,
        emailVerificationExpires: otpExpiry,
      },
    });

    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Verify Your Email',
      text: `Your verification code is: ${verificationOTP}`,
    });

    return res.status(201).json({
      message: 'User created. Please verify your email.',
      userId: user.id,
      user: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/verifyEmail:
 *   post:
 *     summary: Verify user's email address using OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { error } = verifyEmailValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, otp } = req.body;

    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check OTP
    if (
      user.emailVerificationToken !== otp ||
      user.emailVerificationExpires < new Date()
    ) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Activate user and clear verification tokens
    await prisma.user.update({
      where: { email: email },
      data: {
        isActive: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Authenticate user and get access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account not activated
 *       500:
 *         description: Server error
 */
export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { error } = signinValidation();
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account not activated' });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLogin: new Date(),
      },
    });

    return res.status(200).json({
      message: 'User login successfully',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/forgotPassword:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset OTP sent if account exists
 *       500:
 *         description: Server error
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { error } = forgotPasswordValidation();
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email } = req.body;

    // Find user
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      return res.status(200).json({
        message: 'If an account exists, a reset link has been sent',
      });
    }

    // Generate password reset OTP
    const resetOTP = generateOTP();

    // Store reset token with expiration
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetOTP,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send reset email
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      text: `Your password reset code is: ${resetOTP}`,
    });

    return res.status(200).json({
      message: 'Password reset OTP sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/resetPassword:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { error } = resetPasswordValidation();
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, otp, newPassword } = req.body;

    // Find user
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate reset token
    if (
      user.passwordResetToken !== otp ||
      user.passwordResetExpires < new Date()
    ) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset tokens
    await prisma.user.update({
      where: { email: email },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/refreshAccessToken:
 *   post:
 *     summary: Get new access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       400:
 *         description: Refresh token is required
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Server error
 */
export const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.id,
        refreshToken,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Handle Google OAuth callback after successful authentication
 * @route  /auth/google/callback
 * @method GET
 * @access public
 */
export const googleOAuthCallback = (req, res) => {
  res.status(200).json({ message: 'user signup successfully' });
};

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Authenticate or register user using Google OAuth (for mobile/SPA)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Google authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                     profilePic:
 *                       type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Google authentication failed
 *       500:
 *         description: Server error
 */
export const googleOAuthLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    // Verify Google ID Token
    const ticket = await googleVerifyIdToken(idToken);
    const payload = ticket.getPayload();

    // Find or create user
    let user = await prisma.user.findUnique({
      where: {
        email: payload.email,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          firstName: payload.given_name.trim() || '',
          lastName: payload.family_name.trim() || '',
          username: payload.email.split('@')[0], // Generate username from email
          password: null, // Since it's OAuth
          role: 'MEMBER', // Default role
          profilePic: payload.picture,
          isActive: true,
          preferences: {
            // Optional: store additional OAuth-related info
            googleId: payload.sub,
            authProvider: 'GOOGLE',
          },
        },
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Optional: Store refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLogin: new Date(),
      },
    });

    // Prepare user response (exclude sensitive data)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePic: user.profilePic,
    };

    res.status(200).json({
      message: 'Google authentication successful',
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(400).json({
      message: 'Google authentication failed',
      error: error.message,
    });
  }
};
