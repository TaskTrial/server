export const verifyOwnerOrAdmin = (req, res, next) => {
  const { role } = req.user;

  if (role === 'OWNER' || role === 'ADMIN') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Only organization owners or admins can perform this action',
  });
};
