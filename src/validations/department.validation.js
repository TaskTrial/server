import Joi from 'joi';

export const validateCreateDepartment = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().optional().allow('', null),
    organizationId: Joi.string().uuid().required(),
    managerId: Joi.string().uuid().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};
