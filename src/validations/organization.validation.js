import Joi from 'joi';

export const createOrganizationValidation = (obj) => {
  const schema = Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      'string.empty': 'Organization name is required',
      'string.min': 'Organization name must be at least 2 characters long',
      'string.max': 'Organization name cannot exceed 100 characters',
    }),

    description: Joi.string().allow('').max(500).messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),

    industry: Joi.string().required().messages({
      'string.empty': 'Industry is required',
    }),

    sizeRange: Joi.string()
      .valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')
      .required()
      .messages({
        'any.only': 'Invalid size range selection',
        'any.required': 'Size range is required',
      }),

    website: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .allow('')
      .messages({
        'string.uri':
          'Website must be a valid URL starting with http:// or https://',
      }),

    logoUrl: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .allow('')
      .messages({
        'string.uri':
          'Logo URL must be a valid URL starting with http:// or https://',
      }),

    address: Joi.string().allow('').max(255).messages({
      'string.max': 'Address cannot exceed 255 characters',
    }),

    contactEmail: Joi.string().email().required().messages({
      'string.email': 'Contact email must be a valid email address',
      'string.empty': 'Contact email is required',
    }),

    contactPhone: Joi.string()
      .pattern(/^\+?[0-9\s\-()]{10,20}$/)
      .allow('')
      .messages({
        'string.pattern.base':
          'Phone number must be 10-20 digits and may include +, -, or spaces',
      }),

    orgOwnerId: Joi.string().uuid().messages({
      'string.guid': 'Owner ID must be a valid UUID',
    }),
  }).options({
    abortEarly: false, // Return all validation errors, not just the first one
    allowUnknown: false, // Reject unknown fields in the request body
  });

  return schema.validate(obj);
};

export const verifyOrganizationValidation = (obj) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Contact email must be a valid email address',
      'string.empty': 'Contact email is required',
    }),
    otp: Joi.string().required().trim().messages({
      'string.empty': 'OTP is required.',
    }),
  });

  return schema.validate(obj);
};
