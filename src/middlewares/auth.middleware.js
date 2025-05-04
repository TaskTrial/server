import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';

export const verifyAccessToken = (req, res, next) => {
  // Extract token from "Bearer <token>" format
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // ["Bearer", "<token>"]

  try {
    /* eslint no-undef: off */
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Check token expiry
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return res.status(401).json({ message: 'Token expired' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export const verifySocketToken = async (socket, next) => {
  try {
    // Get token from handshake auth or query params
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach user to socket
    socket.user = user;
    next();
  } catch (error) {
    /* eslint no-console: off */
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};
