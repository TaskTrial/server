import Joi from 'joi';

export const createProjectValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required().messages({
      'string.base': 'Project name must be a string',
      'string.empty': 'Project name cannot be empty',
      'string.min': 'Project name must be at least 3 characters long',
      'string.max': 'Project name cannot exceed 100 characters',
      'any.required': 'Project name is required',
    }),

    description: Joi.string().trim().allow('').max(1000).messages({
      'string.base': 'Description must be a string',
      'string.max': 'Description cannot exceed 1000 characters',
    }),

    status: Joi.string()
      .valid('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELED')
      .default('PLANNING')
      .messages({
        'string.base': 'Status must be a string',
        'any.only':
          'Status must be one of: PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELED',
      }),

    startDate: Joi.date().iso().required().messages({
      'date.base': 'Start date must be a valid date',
      'date.format': 'Start date must be in ISO format (YYYY-MM-DD)',
      'any.required': 'Start date is required',
    }),

    endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
      'date.base': 'End date must be a valid date',
      'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
      'date.min': 'End date must be after start date',
      'any.required': 'End date is required',
    }),

    priority: Joi.string()
      .valid('LOW', 'MEDIUM', 'HIGH', 'URGENT')
      .default('MEDIUM')
      .messages({
        'string.base': 'Priority must be a string',
        'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT',
      }),

    budget: Joi.number().precision(2).min(0).allow(null).messages({
      'number.base': 'Budget must be a number',
      'number.min': 'Budget cannot be negative',
      'number.precision': 'Budget cannot have more than 2 decimal places',
    }),

    members: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().uuid().required().messages({
            'string.base': 'User ID must be a string',
            'string.guid': 'User ID must be a valid UUID',
            'any.required': 'User ID is required for each member',
          }),
          role: Joi.string()
            .valid('DEVELOPER', 'TESTER', 'DESIGNER', 'PRODUCT_OWNER', 'MEMBER')
            .default('MEMBER')
            .messages({
              'string.base': 'Role must be a string',
              'any.only':
                'Role must be one of: DEVELOPER, TESTER, DESIGNER, PRODUCT_OWNER, MEMBER',
            }),
        }),
      )
      .default([])
      .messages({
        'array.base': 'Members must be an array',
      }),

    progress: Joi.number().min(0).max(100).default(0).messages({
      'number.base': 'Progress must be a number',
      'number.min': 'Progress cannot be less than 0',
      'number.max': 'Progress cannot exceed 100',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};
