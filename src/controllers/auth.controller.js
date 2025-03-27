import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/prismaClient.js';
import { hashPassword } from '../utils/password.utils.js';
import { generateOTP } from '../utils/otp.utils.js';
import { sendEmail } from '../utils/email.utils.js';
import { signupValidation } from '../validations/auth.validations.js';

/* eslint no-undef:off */
// Authentication Controllers
export const signup = async (req, res) => {
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
    return res.status(500).json({ message: `Signup failed: ${error.message}` });
  }
};
