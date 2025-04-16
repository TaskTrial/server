// src/middleware/authMiddleware.js
import firebaseAdmin from '../config/firebase.js';
import prisma from '../config/prismaClient.js';

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    req.firebaseUser = decodedToken;
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};
