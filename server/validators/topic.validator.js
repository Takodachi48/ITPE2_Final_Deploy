// server/validators/topic.validator.js
import { z } from 'zod';
import { uuidSchema } from './common.js';

export const createTopicSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.'),
    status: z.enum(['draft', 'published']).optional().default('draft'),
  })
  .strict();

export const updateTopicSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(['draft', 'published']).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const bulkTopicsSchema = z
  .object({
    count: z.coerce.number().int().min(1).max(40),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    meetingDays: z.array(z.number().int().min(0).max(6)).min(1),
    titlePrefix: z.string().trim().max(100).optional().default('Topic'),
  })
  .strict();

export const reorderTopicsSchema = z.object({
  topicIds: z.array(uuidSchema).min(1),
});