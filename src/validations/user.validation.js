import Joi from 'joi';

export const updateUserAccountValidation = (obj) => {
  const schema = Joi.object({
    firstName: Joi.string().trim().min(3).max(100).messages({
      'string.min': 'First name must be at least 3 characters long',
      'string.max': 'First name cannot exceed 100 characters',
      'string.empty': 'First name cannot be empty',
    }),
    lastName: Joi.string().trim().min(3).max(100).messages({
      'string.min': 'Last name must be at least 3 characters long',
      'string.max': 'Last name cannot exceed 100 characters',
      'string.empty': 'Last name cannot be empty',
    }),
    phoneNumber: Joi.string()
      .trim()
      .max(50)
      .pattern(/^\+?[0-9\s\-()]{7,}$/)
      .messages({
        'string.pattern.base': 'Invalid phone number format',
        'string.max': 'Phone number cannot exceed 50 characters',
      }),
    jobTitle: Joi.string().trim().max(100).messages({
      'string.max': 'Job title cannot exceed 100 characters',
    }),
    timezone: Joi.string().trim().max(50).messages({
      'string.max': 'Timezone cannot exceed 50 characters',
    }),
    bio: Joi.string().max(1000).messages({
      'string.max': 'Bio cannot exceed 1000 characters',
    }),
  });

  return schema.validate(obj, { abortEarly: false });
};

export const updateUserPasswordValidation = (obj) => {
  const schema = Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required',
    }),
    newPassword: Joi.string()
      .required()
      .min(8)
      .max(32)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      )
      .messages({
        'string.empty': 'New password cannot be empty',
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password cannot exceed 32 characters',
        'string.pattern.base':
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Confirm password is required',
      }),
  });

  return schema.validate(obj, { abortEarly: false });
};
