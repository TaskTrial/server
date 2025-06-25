// Mock middleware for testing
export const mockAuthMiddleware = (req, res, next) => {
  // Mock authenticated user
  req.user = {
    id: 'mock-user-id',
    role: 'MEMBER',
  };
  next();
};

export const errorHandlerMiddleware = (err, req, res) => {
  res
    .status(500)
    .json({ message: 'Internal server error', error: err.message });
};

export default {
  mockAuthMiddleware,
  errorHandlerMiddleware,
};
