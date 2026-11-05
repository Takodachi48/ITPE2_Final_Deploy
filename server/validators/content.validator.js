// server/validators/content.validator.js
import { z } from 'zod';
import { httpUrlSchema } from './common.js';

export const contentBlockSchema = z
  .object({
    type: z.enum(['text', 'summary', 'notes', 'presentation', 'video', 'file']),
    title: z.string().trim().max(200).optional().nullable(),
    body: z.string().max(50000).optional().nullable(),
    url: httpUrlSchema.optional().nullable(),
    filePath: z.string().max(500).optional().nullable(),
    fileName: z.string().max(200).optional().nullable(),
    fileMime: z.string().max(100).optional().nullable(),
    fileSize: z.number().int().positive().optional().nullable(),
    visibleToStudents: z.boolean().optional().default(true),
    position: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (['text', 'summary', 'notes'].includes(data.type) && !data.body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: `${data.type} blocks require a body.`,
      });
    }
    if (data.type === 'presentation' && !data.url && !data.filePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'Presentation blocks require a URL or file.',
      });
    }
    if (data.type === 'video' && !data.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'Video blocks require a URL.',
      });
    }
    if (data.type === 'file' && !data.filePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['filePath'],
        message: 'File blocks require a file.',
      });
    }
  });

export const updateContentBlockSchema = z
  .object({
    title: z.string().trim().max(200).optional().nullable(),
    body: z.string().max(50000).optional().nullable(),
    url: httpUrlSchema.optional().nullable(),
    filePath: z.string().max(500).optional().nullable(),
    fileName: z.string().max(200).optional().nullable(),
    fileMime: z.string().max(100).optional().nullable(),
    fileSize: z.number().int().positive().optional().nullable(),
    visibleToStudents: z.boolean().optional(),
    position: z.number().int().positive().optional(),
  })
  .strict();