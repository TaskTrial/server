import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/prismaClient.js';
import * as dotenv from 'dotenv';
dotenv.config();

/* eslint no-undef: off */
export const googleVerifyIdToken = async (idToken) => {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Extract user information
    const { email, picture, sub: googleId } = payload;

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName: payload.given_name || 'First',
          lastName: payload.family_name || 'Last',
          username: email.split('@')[0],
          password: null, // No password for OAuth users
          role: 'MEMBER',
          isActive: true,
          profilePic: picture,
          preferences: {
            googleProvider: {
              id: googleId,
            },
          },
        },
      });
    }

    return {
      ticket,
      user,
    };
  } catch (error) {
    throw new Error(`Invalid Google ID Token: ${error.message}`);
  }
};

// Optional: Helper function to extract user details from verified token
export const extractGoogleUserDetails = (ticket) => {
  const payload = ticket.getPayload();
  return {
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    profilePic: payload.picture,
    googleId: payload.sub,
  };
};
