export const verifyUserPermission = (req, res, next) => {
  if (req.params.id === req.user.id || req.user.role === 'ADMIN') {
    return next();
  }
  // Otherwise deny access
  return res
    .status(403)
    .json({ message: 'You do not have permission to do this operation' });
};
