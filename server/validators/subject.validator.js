import { z } from 'zod';

export const termSchema = z.enum(['1st Semester', '2nd Semester', 'Summer', '3rd Semester']);

export const schoolYearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, 'School year must be in YYYY-YYYY format.')
  .refine((value) => {
    const [first, second] = value.split('-').map(Number);
    return second === first + 1;
  }, 'The second year must be one more than the first.');

export const subjectCodeSchema = z
  .string()
  .trim()
  .min(1, 'Subject code is required.')
  .max(20, 'Subject code must be 20 characters or fewer.')
  .transform((value) => value.toUpperCase());

export const passingPercentSchema = z.coerce
  .number()
  .int('Passing percent must be a whole number.')
  .min(1, 'Passing percent must be at least 1.')
  .max(100, 'Passing percent must be 100 or less.');

export const createSubjectSchema = z
  .object({
    code: subjectCodeSchema,
    name: z.string().trim().min(1, 'Subject name is required.').max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    term: termSchema,
    schoolYear: schoolYearSchema,
    passingPercent: passingPercentSchema.optional().default(75),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    meetingDay: z.coerce.number().int().min(0).max(6).optional().nullable(),
  })
  .strict();

export const updateSubjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    term: termSchema.optional(),
    schoolYear: schoolYearSchema.optional(),
    passingPercent: passingPercentSchema.optional(),
    enrollmentOpen: z.boolean().optional(),
    status: z.enum(['active', 'archived']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    meetingDay: z.coerce.number().int().min(0).max(6).optional().nullable(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const enrollSchema = z.object({
  joinCode: z.string().trim().min(1, 'Join code is required.').max(20),
});