import { z } from 'zod';
import {
  moduleIdSchema,
  moduleStatusSchema,
  optionalHttpUrlSchema,
  presenterIdsSchema,
  slugSchema,
  videoInputSchema,
} from './common.js';

const titleSchema = z.string().trim().min(2).max(160);
const descriptionSchema = z.string().trim().min(10).max(600);
const summarySchema = z.string().trim().max(50_000).optional().default('');
const themeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, 'Choose a valid theme id.');

const baseModuleFields = {
  title: titleSchema,
  description: descriptionSchema,
  summary: summarySchema,
  pptUrl: optionalHttpUrlSchema,
  themeId: themeIdSchema,
  status: moduleStatusSchema.optional().default('draft'),
  videos: z.array(videoInputSchema).max(10).optional(),
  presenterIds: presenterIdsSchema.optional(),
};

export const createModuleSchema = z.object({
  id: moduleIdSchema.optional(),
  slug: slugSchema.optional(),
  ...baseModuleFields,
});

export const updateModuleSchema = z
  .object({
    title: titleSchema.optional(),
    slug: slugSchema.optional(),
    description: descriptionSchema.optional(),
    summary: z.string().trim().max(50_000).optional(),
    pptUrl: optionalHttpUrlSchema,
    themeId: themeIdSchema.optional(),
    status: moduleStatusSchema.optional(),
    videos: z.array(videoInputSchema).max(10).optional(),
    presenterIds: presenterIdsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one module field to update.',
  });

export const moduleListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  theme: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  presenter: z.string().uuid().optional(),
  status: moduleStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
