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
  }).options({ allowUnknown: true }); // Allow unknown fields

  return schema.validate(obj, { abortEarly: false });
};

export const updatePasswordValidation = (obj) => {
  const schema = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required().messages({
      'string.min': 'New password must be at least 8 characters long',
    }),
  });

  return schema.validate(obj);
};

export const profilePictureValidation = Joi.object({
  profilePicture: Joi.any(), // This will be handled by multer
});
