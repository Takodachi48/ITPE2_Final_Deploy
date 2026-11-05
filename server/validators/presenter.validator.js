import { z } from 'zod';

const presenterNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .refine((value) => value.includes(','), {
    message: 'Use the class format: LASTNAME, FIRSTNAME.',
  });

export const createPresenterSchema = z.object({
  name: presenterNameSchema,
});

export const updatePresenterSchema = z
  .object({
    name: presenterNameSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide a name to update.',
  });
