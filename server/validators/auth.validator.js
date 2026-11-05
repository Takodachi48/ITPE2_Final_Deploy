import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Enter your password.').max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'faculty', 'student']),
});

export const updateProfileAdminSchema = z
  .object({
    role: z.enum(['admin', 'faculty', 'student']).optional(),
    approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  })
  .strict()
  .refine((data) => data.role !== undefined || data.approvalStatus !== undefined, {
    message: 'At least one of role or approvalStatus is required.',
  });

export const updateMeSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.').max(60).optional(),
    lastName: z.string().trim().min(1, 'Last name is required.').max(60).optional(),
    studentNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{4,20}$/, 'Student number must be 4 to 20 characters (letters, digits, hyphens).')
      .optional(),
  })
  .strict();

const studentNumberSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9-]{4,20}$/,
    'Student number must be 4 to 20 characters (letters, digits, hyphens).',
  );

export const registerSchema = z
  .object({
    role: z.enum(['student', 'faculty']),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email address.')
      .max(254),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(200),
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required.')
      .max(60, 'First name must be 60 characters or fewer.'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required.')
      .max(60, 'Last name must be 60 characters or fewer.'),
    studentNumber: studentNumberSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.role === 'student' && !data.studentNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentNumber'],
        message: 'Student number is required for students.',
      });
    }
  });
