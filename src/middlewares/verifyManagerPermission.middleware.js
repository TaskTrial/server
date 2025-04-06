export const verifyManagerPermission = (req, res, next) => {
  const allowedRoles = ['MANAGER', 'ADMIN', 'OWNER'];

  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    message: 'You do not have permission to perform this operation',
  });
};
