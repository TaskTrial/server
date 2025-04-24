import Joi from 'joi';

export const createTaskValidation = (obj) => {
  const schema = Joi.object({
    title: Joi.string().trim().min(3).max(200).required().messages({
      'string.base': 'Task title must be a string',
      'string.empty': 'Task title cannot be empty',
      'string.min': 'Task title must be at least 3 characters long',
      'string.max': 'Task title cannot exceed 200 characters',
      'any.required': 'Task title is required',
    }),
    description: Joi.string().trim().allow('', null).max(5000).messages({
      'string.base': 'Task description must be a string',
      'string.max': 'Task description cannot exceed 5000 characters',
    }),
    priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').required().messages({
      'string.base': 'Priority must be a string',
      'any.only': 'Priority must be one of: HIGH, MEDIUM, LOW',
      'any.required': 'Priority is required',
    }),
    sprintId: Joi.string().uuid().allow(null).messages({
      'string.base': 'Sprint ID must be a string',
      'string.guid': 'Sprint ID must be a valid UUID',
    }),
    assignedTo: Joi.string().uuid().allow(null).messages({
      'string.base': 'Assigned user ID must be a string',
      'string.guid': 'Assigned user ID must be a valid UUID',
    }),
    dueDate: Joi.date().iso().required().messages({
      'date.base': 'Due date must be a valid date',
      'date.format': 'Due date must be in ISO format',
      'any.required': 'Due date is required',
    }),
    estimatedTime: Joi.number().positive().allow(null).messages({
      'number.base': 'Estimated time must be a number',
      'number.positive': 'Estimated time must be a positive number',
    }),
    parentId: Joi.string().uuid().allow(null).messages({
      'string.base': 'Parent task ID must be a string',
      'string.guid': 'Parent task ID must be a valid UUID',
    }),
    labels: Joi.array().items(Joi.string().trim()).default([]).messages({
      'array.base': 'Labels must be an array',
      'string.base': 'Each label must be a string',
    }),
    // Additional fields if needed
    rate: Joi.number().positive().allow(null).messages({
      'number.base': 'Rate must be a number',
      'number.positive': 'Rate must be a positive number',
    }),
    order: Joi.number().integer().min(0).default(0).messages({
      'number.base': 'Order must be a number',
      'number.integer': 'Order must be an integer',
      'number.min': 'Order must be a non-negative number',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};

export const updateTaskValidation = (obj) => {
  const schema = Joi.object({
    title: Joi.string().trim().min(3).max(200).optional().messages({
      'string.base': 'Task title must be a string',
      'string.empty': 'Task title cannot be empty',
      'string.min': 'Task title must be at least 3 characters long',
      'string.max': 'Task title cannot exceed 200 characters',
    }),
    description: Joi.string().trim().allow('', null).max(5000).messages({
      'string.base': 'Task description must be a string',
      'string.max': 'Task description cannot exceed 5000 characters',
    }),
    status: Joi.string()
      .valid('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE')
      .optional()
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: TODO, IN_PROGRESS, REVIEW, DONE',
      }),
    priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').optional().messages({
      'string.base': 'Priority must be a string',
      'any.only': 'Priority must be one of: HIGH, MEDIUM, LOW',
    }),
    sprintId: Joi.string().uuid().allow(null).messages({
      'string.base': 'Sprint ID must be a string',
      'string.guid': 'Sprint ID must be a valid UUID',
    }),
    assignedTo: Joi.string().uuid().allow(null).messages({
      'string.base': 'Assigned user ID must be a string',
      'string.guid': 'Assigned user ID must be a valid UUID',
    }),
    dueDate: Joi.date().iso().optional().messages({
      'date.base': 'Due date must be a valid date',
      'date.format': 'Due date must be in ISO format',
    }),
    estimatedTime: Joi.number().positive().allow(null).messages({
      'number.base': 'Estimated time must be a number',
      'number.positive': 'Estimated time must be a positive number',
    }),
    parentId: Joi.string().uuid().allow(null).messages({
      'string.base': 'Parent task ID must be a string',
      'string.guid': 'Parent task ID must be a valid UUID',
    }),
    labels: Joi.array().items(Joi.string().trim()).default([]).messages({
      'array.base': 'Labels must be an array',
      'string.base': 'Each label must be a string',
    }),
    // Additional fields if needed
    rate: Joi.number().positive().allow(null).messages({
      'number.base': 'Rate must be a number',
      'number.positive': 'Rate must be a positive number',
    }),
    order: Joi.number().integer().min(0).default(0).messages({
      'number.base': 'Order must be a number',
      'number.integer': 'Order must be an integer',
      'number.min': 'Order must be a non-negative number',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};
