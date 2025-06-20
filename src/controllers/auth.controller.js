import * as dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import { comparePassword, hashPassword } from '../utils/password.utils.js';
import { generateOTP, hashOTP, validateOTP } from '../utils/otp.utils.js';
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
import {
  createActivityLog,
  generateActivityDetails,
} from '../utils/activityLogs.utils.js';
import firebaseAdmin from '../config/firebase.js';

/* eslint no-undef:off */
/**
 * @desc   Creates a new user account and sends verification OTP to email
 * @route  /api/auth/signup
 * @method POST
 * @access public
 */
export const signup = async (req, res, next) => {
  try {
    const { error } = signupValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, password, firstName, lastName, username } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
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
    const hashedOTP = await hashOTP(verificationOTP);
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
        emailVerificationToken: hashedOTP,
        emailVerificationExpires: otpExpiry,
      },
    });

    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Verify Your Email',
      text: `Your verification code is: ${verificationOTP}`,
    });

    await createActivityLog({
      entityType: 'USER',
      action: 'CREATED',
      userId: user.id,
      details: generateActivityDetails('CREATED', null, {
        userId: user.id,
        email: user.email,
        createdAt: user.createdAt,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      }),
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
 * @desc   Resend OTP code if it expired
 * @route  /api/auth/resendOTP/
 * @method POST
 * @access private
 */
export const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // generate OTP
    const verificationOTP = generateOTP();
    const hashedOTP = await hashOTP(verificationOTP);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        emailVerificationToken: hashedOTP,
        emailVerificationExpires: otpExpiry,
      },
    });

    try {
      // Send verification email
      await sendEmail({
        to: email,
        subject: 'Re-verify Your Email',
        text: `Your verification code is: ${verificationOTP}. It will expire in 10 minutes`,
      });
    } catch (emailError) {
      return res.status(500).json({
        success: false,
        error: emailError,
        message: 'Failed to send verification email. Please try again later.',
      });
    }

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: user.id,
      details: {
        action: 'RESEND_OTP',
        email: user.email,
        timestamp: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Code send successfully. Please check your email',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Verify user's email address using the OTP sent to their email
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

    if (!user.emailVerificationToken || !user.emailVerificationExpires) {
      return res
        .status(400)
        .json({ message: 'Email already verified or invalid token' });
    }

    // Check OTP
    if (
      !(await validateOTP(otp, user.emailVerificationToken)) ||
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

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: user.id,
      details: {
        action: 'EMAIL_VERIFIED',
        email: user.email,
        verifiedAt: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Authenticate user and return JWT tokens
 * @route  /api/auth/signin
 * @method POST
 * @access public
 */
export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { error } = signinValidation(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: 'Account not activated. Please verify your email' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token in DB (useful for logout)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLogin: new Date(),
      },
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: user.id,
      details: {
        action: 'SIGN_IN',
        email: user.email,
        signedInAt: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    return res.status(200).json({
      message: 'User login successfully',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePic: user.profilePic,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        firebaseUid: user.firebaseUid,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Initiate password reset process by sending OTP to user's email
 * @route  /api/auth/forgotPassword
 * @method POST
 * @access public
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { error } = forgotPasswordValidation(req.body);
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
    const hashedOTP = await hashOTP(resetOTP);

    // Store reset token with expiration
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedOTP,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send reset email
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      text: `Your password reset code is: ${resetOTP}`,
    });

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: user.id,
      details: {
        action: 'FORGOT_PASSWORD_REQUESTED',
        email: user.email,
        requestedAt: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    return res.status(200).json({
      message: 'Password reset OTP sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Reset user password using the OTP received via email
 * @route  /api/auth/resetPassword
 * @method POST
 * @access public
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { error } = resetPasswordValidation(req.body);
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
      !(await validateOTP(otp, user.passwordResetToken)) ||
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

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: user.id,
      details: {
        action: 'PASSWORD_RESET',
        email: user.email,
        resetAt: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Initiate password reset using refreshToken to identify user
 * @route  /api/auth/forgotPassword
 * @method POST
 * @access private (via refreshToken cookie)
 */
export const forgotPasswordWithoutEmail = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(200).json({
        message: 'If an account exists, a reset code has been sent',
      });
    }

    // Generate password reset OTP
    const resetOTP = generateOTP();
    const hashedOTP = await hashOTP(resetOTP);

    // Store reset token with expiration
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedOTP,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send OTP via email
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Your password reset code is: ${resetOTP}`,
    });

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: user.id,
      details: {
        action: 'FORGOT_PASSWORD_ALT_REQUESTED',
        userId: user.id,
        requestedAt: new Date(),
        method: 'alternative',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    return res.status(200).json({
      message: 'Password reset OTP sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Reset user password using the OTP received via email
 * @route  /api/auth/resetPassword
 * @method POST
 * @access public
 */
export const resetPasswordWithoutEmail = async (req, res, next) => {
  try {
    const { error } = resetPasswordValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { otp, newPassword } = req.body;

    // Validate reset token
    if (
      !(await validateOTP(otp, user.passwordResetToken)) ||
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
      where: { email: user.email },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: user.id,
      details: {
        action: 'PASSWORD_RESET_ALT',
        userId: user.id,
        resetAt: new Date(),
        method: 'alternative',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
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
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET,
      async (err, decoded) => {
        if (err || !decoded || !decoded.id) {
          return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
        });
        if (!user || user.refreshToken !== refreshToken) {
          return res.status(403).json({ message: 'Token mismatch' });
        }

        const newAccessToken = jwt.sign(
          { id: user.id, role: user.role },
          process.env.JWT_ACCESS_SECRET,
          { expiresIn: '1h' },
        );

        await createActivityLog({
          entityType: 'USER',
          action: 'UPDATED',
          userId: user.id,
          details: {
            action: 'TOKEN_REFRESHED',
            userId: user.id,
            refreshedAt: new Date(),
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
          },
        });

        res.status(200).json({ accessToken: newAccessToken });
      },
    );
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Handle Google OAuth callback after successful authentication
 * @route  /auth/google/callback
 * @method GET
 * @access public
 */
export const googleOAuthCallback = (req, res) => {
  res.status(200).json({ message: 'user login successfully' });
};

/**
 * @desc   Authenticate or register user using Google OAuth
 * @route  /api/auth/google
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

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          firstName: payload.given_name?.trim() || '',
          lastName: payload.family_name?.trim() || '',
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
    } else {
      // Update last login time for existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in database
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
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profilePic: user.profilePic,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      firebaseUid: user.firebaseUid,
    };

    await createActivityLog({
      entityType: 'USER',
      action: isNewUser ? 'CREATED' : 'UPDATED',
      userId: user.id,
      details: {
        action: isNewUser ? 'GOOGLE_OAUTH_SIGNUP' : 'GOOGLE_OAUTH_SIGNIN',
        userId: user.id,
        email: user.email,
        timestamp: new Date(),
        provider: 'google',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    res.status(200).json({
      message: 'Google authentication successful',
      user: userResponse,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Google authentication failed',
      error: error.message,
    });
  }
};

/**
 * @desc   Log out user by invalidating their refresh token
 * @route  /api/auth/logout
 * @method POST
 * @access private (requires authentication)
 */
export const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.sendStatus(204); // No content
    }

    const decoded = jwt.decode(token);
    if (decoded?.id) {
      await prisma.user.update({
        where: { id: decoded.id },
        data: { refreshToken: null },
      });
    }

    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Strict',
    });

    await createActivityLog({
      entityType: 'USER',
      action: 'UPDATED',
      userId: decoded.id,
      details: {
        action: 'LOGGED_OUT',
        userId: decoded.id,
        loggedOutAt: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Login with firebase
 */
export const firebaseLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    // Verify the Firebase ID token
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { firebaseUid: uid },
    });

    const isNewUser = !user;

    if (!user) {
      // If not found by Firebase UID, try finding by email
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Link existing user with Firebase
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            firebaseUid: uid,
            lastLogin: new Date(),
          },
        });
      } else {
        // Create new user
        // Extract first and last name from full name
        const nameParts = name ? name.split(' ') : ['User', ''];
        const firstName = nameParts[0];
        const lastName =
          nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // Generate a unique username based on email
        const baseUsername = email.split('@')[0];
        let username = baseUsername;
        let counter = 1;

        // Check if username exists and add number if needed
        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        user = await prisma.user.create({
          data: {
            email,
            firebaseUid: uid,
            username,
            firstName,
            lastName,
            role: 'MEMBER',
            profilePic: picture || null,
            lastLogin: new Date(),
            password: null, // No password for Firebase users
            isActive: true,
          },
        });
      }
    } else {
      // Update last login time
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLogin: new Date(),
      },
    });

    await createActivityLog({
      entityType: 'USER',
      action: isNewUser ? 'CREATED' : 'UPDATED',
      userId: user.id,
      details: {
        action: isNewUser ? 'FIREBASE_SIGNUP' : 'FIREBASE_SIGNIN',
        userId: user.id,
        email: user.email,
        timestamp: new Date(),
        provider: 'firebase',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    });

    return res.status(200).json({
      message: 'Firebase authentication successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profilePic: user.profilePic,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        firebaseUid: user.firebaseUid,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};
