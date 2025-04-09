import Joi from 'joi';

export const createProjectValidation = (obj) => {
  const schema = Joi.object({});

  return schema.validate(obj, { abortEarly: false });
};
