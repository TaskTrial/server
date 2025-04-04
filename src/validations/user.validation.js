import Joi from 'joi';

export const updateUserAccountValidation = (obj) => {
  const schema = Joi.object({
    firstName: Joi.string().trim().min(3).max(30).messages({
      'string.min': 'First name must be at least 3 characters long.',
      'string.max': 'First name must be at most 30 characters long.',
    }),
    lastName: Joi.string().trim().messages({
      'string.min': 'Last name must be at least 3 characters long.',
      'string.max': 'Last name must be at most 30 characters long.',
    }),
    gender: Joi.string().valid('Male', 'Female').messages({
      'any.only': "Gender must be either 'male' or 'female'.",
    }),
    DOB: Joi.date()
      .max(new Date(new Date().setFullYear(new Date().getFullYear() - 18))) // Ensures the user is at least 18 years old
      .messages({
        'date.base': 'Invalid date format for DOB.',
        'date.max': 'You must be at least 18 years old.',
      }),
    mobileNumber: Joi.string().trim().messages({
      'string.empty': 'Mobile number cannot be empty if provided',
    }),
  }).min(1); // At least one field must be provided

  return schema.validate(obj);
};

export const updateUserPasswordValidation = (obj) => {
  const schema = Joi.object({
    password: Joi.string().required().trim().min(8).max(32).messages({
      'string.empty': 'Password is required.',
      'string.min': 'Password must be at least 8 characters long.',
      'string.max': 'Password must be at most 32 characters long.',
    }),
  });
  return schema.validate(obj);
};
