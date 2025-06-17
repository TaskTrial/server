import Joi from 'joi';

export const createChatRoomValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(100).messages({
      'string.empty': 'Chat room name is required',
      'string.min': 'Chat room name must be at least 3 characters long',
      'string.max': 'Chat room name cannot exceed 100 characters',
    }),

    description: Joi.string().allow('').max(500).messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),

    type: Joi.string().valid('GROUP', 'DIRECT', 'CHANNEL').required().messages({
      'any.only': 'Type must be one of GROUP, DIRECT, or CHANNEL',
      'any.required': 'Chat room type is required',
    }),

    entityType: Joi.string()
      .valid('ORGANIZATION', 'DEPARTMENT', 'TEAM', 'PROJECT', 'TASK')
      .required()
      .messages({
        'any.only':
          'Entity type must be one of ORGANIZATION, DEPARTMENT, TEAM, PROJECT, or TASK',
        'any.required': 'Entity type is required',
      }),

    entityId: Joi.string().required().messages({
      'string.empty': 'Entity ID is required',
      'any.required': 'Entity ID is required',
    }),
  }).options({
    abortEarly: false,
    allowUnknown: false,
  });

  return schema.validate(obj);
};

export const updateChatRoomValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(100).optional().messages({
      'string.min': 'Chat room name must be at least 3 characters long',
      'string.max': 'Chat room name cannot exceed 100 characters',
    }),

    description: Joi.string().allow('').max(500).messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),

    isArchived: Joi.boolean().optional(),
  })
    .min(1)
    .options({
      abortEarly: false,
      allowUnknown: false,
    });

  return schema.validate(obj);
};

export const addParticipantsValidation = (obj) => {
  const schema = Joi.object({
    userIds: Joi.array()
      .items(Joi.string().required())
      .min(1)
      .required()
      .messages({
        'array.base': 'User IDs must be an array',
        'array.min': 'At least one user ID is required',
        'any.required': 'User IDs are required',
      }),
  }).options({
    abortEarly: false,
    allowUnknown: false,
  });

  return schema.validate(obj);
};

export const messageValidation = (obj) => {
  const schema = Joi.object({
    content: Joi.string().required().max(10000).messages({
      'string.empty': 'Message content cannot be empty',
      'string.max': 'Message content cannot exceed 10000 characters',
      'any.required': 'Message content is required',
    }),

    contentType: Joi.string()
      .valid('TEXT', 'IMAGE', 'FILE', 'VIDEO', 'AUDIO', 'SYSTEM')
      .default('TEXT')
      .messages({
        'any.only':
          'Content type must be one of TEXT, IMAGE, FILE, VIDEO, AUDIO, or SYSTEM',
      }),

    replyToId: Joi.string().allow(null).optional(),

    metadata: Joi.object().allow(null).optional(),
  }).options({
    abortEarly: false,
    allowUnknown: false,
  });

  return schema.validate(obj);
};

export const reactionValidation = (obj) => {
  const schema = Joi.object({
    reaction: Joi.string().required().max(10).messages({
      'string.empty': 'Reaction cannot be empty',
      'string.max': 'Reaction cannot exceed 10 characters',
      'any.required': 'Reaction is required',
    }),
  }).options({
    abortEarly: false,
    allowUnknown: false,
  });

  return schema.validate(obj);
};
