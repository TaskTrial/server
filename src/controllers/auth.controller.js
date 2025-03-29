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
 * @desc   Register a new user
 * @route  /api/auth/signup
 * @method POST
 * @access public
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
 * @desc   Verify user's email address using verification token
 * @route  /api/auth/verifyEmail
 * @method POST
 * @access public
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
 * @desc   Authenticate user and return access token
 * @route  /api/auth/signin
 * @method POST
 * @access public
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
 * @desc   Initiate password reset process by sending reset token to user's email
 * @route  /api/auth/forgotPassword
 * @method POST
 * @access public
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
 * @desc   Reset user's password using valid reset token
 * @route  /api/auth/resetPassword
 * @method POST
 * @access public
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
 * @desc   Generate new access token using refresh token
 * @route  /api/auth/refreshAccessToken
 * @method POST
 * @access public
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
 * @desc   Authenticate or register user using Google OAuth (for mobile/SPA)
 * @route  /auth/google
 * @method POST
 * @access public
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
