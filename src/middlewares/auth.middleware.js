import jwt from 'jsonwebtoken';

export const verifyAccessToken = (req, res, next) => {
  // Extract token from "Bearer <token>" format
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // ["Bearer", "<token>"]

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

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

// export const authorizeUser = (req, res, next) => {
//   const { user } = req; // Assuming `req.user` is populated by authentication middleware
//   const { id } = req.params;

//   if (!user) {
//     return res.status(401).json({ message: 'Unauthorized' });
//   }

//   // Allow access if the user is an admin or accessing their own data
//   if (user.role === 'ADMIN' || user.id === id) {
//     return next();
//   }

//   return res.status(403).json({ message: 'Forbidden: You do not have access to this resource' });
// };
