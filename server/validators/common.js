import { z } from 'zod';
import { isHttpUrl } from '../utils/url.js';

export const moduleIdSchema = z.coerce
  .number()
  .int('Module ids must be whole numbers.')
  .positive('Module ids must be positive.')
  .max(999, 'Module ids must be 999 or lower.');

export const uuidSchema = z
  .string()
  .uuid('That identifier is not a valid UUID.');

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slugs may only contain lowercase letters, numbers, and single hyphens.',
  );

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(isHttpUrl, 'Enter a valid HTTP or HTTPS URL.');

export const optionalHttpUrlSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.union([httpUrlSchema, z.null()]).optional(),
);

export const moduleStatusSchema = z.enum(['draft', 'published', 'archived']);

export const roleSchema = z.enum(['admin', 'faculty', 'student']);

export const idOrSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9-]*$/,
    'Module references must be a numeric id or a slug.',
  );

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  theme: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  presenter: uuidSchema.optional(),
  status: moduleStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const videoInputSchema = z.object({
  url: httpUrlSchema,
  label: z.string().trim().max(120).optional().nullable(),
});

export const videoUpdateSchema = z
  .object({
    url: httpUrlSchema.optional(),
    label: z.string().trim().max(120).optional().nullable(),
    position: z.coerce.number().int().min(0).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const presenterIdsSchema = z
  .array(uuidSchema)
  .max(10, 'A module can have at most 10 presenters.');
