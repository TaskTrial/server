import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.',
  },
});

// More specific rate limiters for chat functionality
export const chatMessageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Max 20 messages per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'You are sending messages too frequently. Please slow down.',
  },
});

export const chatRoomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 chat rooms per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message:
      'You have created too many chat rooms recently. Please try again later.',
  },
});

export const videoSessionCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 video sessions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message:
      'You have created too many video sessions recently. Please try again later.',
  },
});
