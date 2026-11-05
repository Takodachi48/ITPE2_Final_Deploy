// server/validators/quiz.validator.js
import { z } from 'zod';
import { httpUrlSchema } from './common.js';

const promptSchema = z.string().trim().min(1, 'Prompt is required.').max(2000);

const pointsSchema = z.coerce.number().positive('Points must be greater than 0.').max(100).default(1);

const optionSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required.').max(500),
});

export const choiceQuestionSchema = z
  .object({
    type: z.literal('choice'),
    prompt: promptSchema,
    options: z.array(optionSchema).length(4, 'Multiple choice must have exactly 4 options.'),
    correctOptionIndex: z.coerce.number().int().min(0).max(3),
    points: pointsSchema.optional(),
  })
  .strict()
  .refine((data) => data.correctOptionIndex < data.options.length, {
    message: 'correctOptionIndex must point to an existing option.',
    path: ['correctOptionIndex'],
  });

export const textQuestionSchema = z
  .object({
    type: z.literal('text'),
    prompt: promptSchema,
    acceptedAnswers: z.array(z.string().trim().min(1)).min(1, 'Text question needs at least one accepted answer.'),
    points: pointsSchema.optional(),
  })
  .strict();

export const questionSchema = z.discriminatedUnion('type', [choiceQuestionSchema, textQuestionSchema]);

export const createQuestionSchema = questionSchema;

export const updateQuestionSchema = z
  .object({
    prompt: promptSchema.optional(),
    options: z.array(optionSchema).length(4).optional(),
    correctOptionIndex: z.coerce.number().int().min(0).max(3).optional(),
    acceptedAnswers: z.array(z.string().trim().min(1)).min(1).optional(),
    points: pointsSchema.optional(),
  })
  .strict();

export const quizMetaSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    mode: z.enum(['built', 'uploaded']).optional(),
    instructions: z.string().trim().max(5000).optional().nullable(),
    maxAttempts: z.coerce.number().int().positive().optional().nullable(),
    showAnswers: z.boolean().optional(),
    totalItems: z.coerce.number().int().min(1).max(1000).optional().nullable(),
    externalUrl: httpUrlSchema.optional().nullable(),
    attachmentPath: z.string().max(500).optional().nullable(),
    status: z.enum(['draft', 'published']).optional(),
  })
  .strict();

export const importQuestionSchema = questionSchema;

export const importPayloadSchema = z
  .object({
    questions: z.array(questionSchema).min(1).max(20),
  })
  .strict();

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

export const gradeAttemptSchema = z
  .object({
    score: z.coerce.number().min(0, 'Score cannot be negative.'),
    feedback: z.string().trim().max(5000).optional().nullable(),
  })
  .strict();

export const uploadUrlSchema = z
  .object({
    fileName: z.string().trim().min(1, 'File name is required.'),
    mime: z.string().trim().min(1, 'MIME type is required.'),
    size: z.coerce.number().int().positive('Size must be positive.'),
    kind: z.string().optional(),
  })
  .strict();

export const submissionSchema = z
  .object({
    path: z.string().trim().min(1, 'Path is required.'),
  })
  .strict();

export const generateQuizPreviewSchema = z
  .object({
    contentBlockId: z.string().uuid(),
    count: z.coerce.number().int().min(10).max(20).default(10),
  })
  .strict();

export const generatedQuestionSchema = z.object({
  type: z.literal('choice'),
  prompt: promptSchema,
  options: z.array(optionSchema).length(4, 'Multiple choice must have exactly 4 options.'),
  correctOptionIndex: z.coerce.number().int().min(0).max(3),
  points: pointsSchema.optional(),
});

export const saveGeneratedQuizSchema = z
  .object({
    questions: z.array(generatedQuestionSchema).min(10).max(20),
  })
  .strict();
