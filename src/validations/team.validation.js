import Joi from 'joi';

export const createTeamValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required().trim().messages({
      'string.base': 'Team name must be a string',
      'string.empty': 'Team name is required',
      'string.min': 'Team name must be at least {#limit} characters long',
      'string.max': 'Team name cannot exceed {#limit} characters',
      'any.required': 'Team name is required',
    }),

    description: Joi.string().allow('').optional().messages({
      'string.base': 'Description must be a string',
    }),

    avatar: Joi.string().allow(null, '').optional().messages({
      'string.base': 'Avatar must be a string URL or file path',
    }),

    members: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().uuid().required().messages({
            'string.guid': 'User ID must be a valid UUID',
            'any.required': 'User ID is required for team members',
          }),
          role: Joi.string()
            .valid('MEMBER', 'LEADER', 'VIEWER')
            .default('MEMBER')
            .messages({
              'any.only': 'Role must be one of: MEMBER, LEADER, or VIEWER',
            }),
        }),
      )
      .optional(),
  });

  return schema.validate(obj, { abortEarly: false });
};

export const addTeamMemberValidation = (obj) => {
  const schema = Joi.object({
    members: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().uuid().required().messages({
            'string.uuid': 'User ID must be a valid UUID',
            'any.required': 'User ID is required for team members',
          }),
          role: Joi.string()
            .valid('MEMBER', 'LEADER', 'VIEWER')
            .default('MEMBER')
            .messages({
              'any.only': 'Role must be one of: MEMBER, LEADER, or VIEWER',
            }),
        }),
      )
      .required(),
  });

  return schema.validate(obj, { abortEarly: false });
};

export const updateTeamValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).optional().trim().messages({
      'string.base': 'Team name must be a string',
      'string.empty': 'Team name is required if provided',
      'string.min': 'Team name must be at least {#limit} characters long',
      'string.max': 'Team name cannot exceed {#limit} characters',
    }),

    description: Joi.string().allow('').optional().messages({
      'string.base': 'Description must be a string',
    }),

    avatar: Joi.string().allow(null, '').optional().messages({
      'string.base': 'Avatar must be a string URL or file path',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};
