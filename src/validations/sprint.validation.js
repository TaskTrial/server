import Joi from 'joi';

export const sprintvalidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required().messages({
      'string.base': 'Sprint name must be a string',
      'string.empty': 'Sprint name cannot be empty',
      'string.min': 'Sprint name must be at least 2 characters long',
      'string.max': 'Sprint name cannot exceed 100 characters',
      'any.required': 'Sprint name is required',
    }),

    description: Joi.string().trim().allow('').max(2000).messages({
      'string.base': 'Description must be a string',
      'string.max': 'Description cannot exceed 2000 characters',
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

    goal: Joi.string().trim().allow('').max(500).messages({
      'string.base': 'Goal must be a string',
      'string.max': 'Goal cannot exceed 500 characters',
    }),

    status: Joi.string()
      .valid('PLANNING', 'ACTIVE', 'COMPLETED')
      .default('PLANNING')
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: PLANNING, ACTIVE, COMPLETED',
      }),

    order: Joi.number().integer().min(0).default(0).messages({
      'number.base': 'Order must be a number',
      'number.integer': 'Order must be an integer',
      'number.min': 'Order cannot be negative',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};

export const updateSprintValidation = {
  validate: (obj) => {
    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(100).messages({
        'string.base': 'Sprint name must be a string',
        'string.empty': 'Sprint name cannot be empty',
        'string.min': 'Sprint name must be at least 2 characters long',
        'string.max': 'Sprint name cannot exceed 100 characters',
      }),

      description: Joi.string().trim().allow('').max(2000).messages({
        'string.base': 'Description must be a string',
        'string.max': 'Description cannot exceed 2000 characters',
      }),

      startDate: Joi.date().iso().messages({
        'date.base': 'Start date must be a valid date',
        'date.format': 'Start date must be in ISO format (YYYY-MM-DD)',
      }),

      endDate: Joi.date().iso().messages({
        'date.base': 'End date must be a valid date',
        'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
      }),

      goal: Joi.string().trim().allow('').max(500).messages({
        'string.base': 'Goal must be a string',
        'string.max': 'Goal cannot exceed 500 characters',
      }),

      status: Joi.string().valid('PLANNING', 'ACTIVE', 'COMPLETED').messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: PLANNING, ACTIVE, COMPLETED',
      }),

      order: Joi.number().integer().min(0).messages({
        'number.base': 'Order must be a number',
        'number.integer': 'Order must be an integer',
        'number.min': 'Order cannot be negative',
      }),
    })
      .min(1)
      .messages({
        'object.min': 'At least one field must be provided for update',
      });

    return schema.validate(obj, { abortEarly: false });
  },
};

export const updateSprintStatusValidation = (obj) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('PLANNING', 'ACTIVE', 'COMPLETED')
      .required()
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: PLANNING, ACTIVE, COMPLETED',
        'any.required': 'Status is required',
      }),
  });

  return schema.validate(obj, { abortEarly: false });
};

export const sprintTasksValidation = (obj) => {
  const schema = Joi.object({
    taskIds: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
      'array.base': 'Task IDs must be an array',
      'array.min': 'At least one task ID must be provided',
      'string.guid': 'Each task ID must be a valid UUID',
      'any.required': 'Task IDs are required',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};
