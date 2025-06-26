import passport from 'passport';
import * as dotenv from 'dotenv';
dotenv.config();
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../config/prismaClient.js';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../utils/token.utils.js';

export const configureGoogleStrategy = () => {
  if (process.env.NODE_ENV === 'test') {
    // Skip or use mock during tests
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        /* eslint no-undef: off */
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
        proxy: true,
        state: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0].value
              : null;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Find or create user with Prisma
          let user = await prisma.user.findUnique({
            where: {
              email: email,
              // TODO: If you want to add a specific provider constraint, you might need to modify your schema ( preferences   Json?) in prisma
            },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: email,
                firstName: profile.name.givenName || 'First',
                lastName: profile.name.familyName || 'Last',
                username: email.split('@')[0], // Generate username from email
                password: null, // Since it's OAuth, no password needed
                role: 'MEMBER', // Default role
                isActive: true,
                isOwner: false,
                // TODO: Cloudinary
                profilePic:
                  profile.photos && profile.photos.length > 0
                    ? profile.photos[0].value
                    : null,
                // Additional fields based on your User model
                preferences: {
                  googleProvider: {
                    id: profile.id,
                    // token: accessToken,
                  },
                },
              },
            });
          }

          // Generate tokens
          const accessToken = generateAccessToken(user);
          const refreshToken = generateRefreshToken(user);

          // You might want to store refresh token in the database
          await prisma.user.update({
            where: { id: user.id },
            data: {
              refreshToken: refreshToken,
            },
          });

          // Attach tokens to the user object
          return done(null, {
            ...user,
            accessToken: () => accessToken,
            refreshToken: () => refreshToken,
          });
        } catch (error) {
          return done(error, false);
        }
      },
    ),
  );

  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      done(null, user);
    } catch (error) {
      done(error, false);
    }
  });
};
