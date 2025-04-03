export const verifyAdminPermission = (req, res, next) => {
  if (req.user.role === 'ADMIN') {
    return next();
  }
  // Otherwise deny access
  return res
    .status(403)
    .json({ message: 'You do not have permission to do this action' });
};
