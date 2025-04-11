import Joi from 'joi';

export const createDepartmentValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().max(100).required().messages({
      'string.base': 'Name must be a string',
      'string.max': 'Name cannot be more than 100 characters',
      'any.required': 'Name is required',
    }),
    description: Joi.string().allow('', null).optional().messages({
      'string.base': 'Description must be a string',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};

export const updateDepartmentValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().max(100).optional().messages({
      'string.base': 'Name must be a string',
      'string.max': 'Name cannot be more than 100 characters',
    }),
    description: Joi.string().allow('', null).optional().messages({
      'string.base': 'Description must be a string',
    }),
  })
    .min(1)
    .messages({
      'object.min': 'At least one field (name or description) must be provided',
    });

  return schema.validate(obj, { abortEarly: false });
};
