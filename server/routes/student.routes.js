// server/routes/student.routes.js
import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole, requireEnrolled } from '../middleware/auth.js';
import {
  enrollStudent,
  listStudentSubjects,
} from '../services/subjects.service.js';
import { enrollLimiter, uploadUrlLimiter, submissionsLimiter } from '../middleware/rateLimit.js';
import { enrollSchema } from '../validators/subject.validator.js';
import { uuidSchema } from '../validators/common.js';
import { uploadUrlSchema, submissionSchema } from '../validators/quiz.validator.js';
import {
  getAttemptHistory,
  startAttempt,
  submitAttempt,
  getStudentUploadUrl,
  createStudentSubmission,
  deletePendingSubmission,
  getStudentAttemptImageUrl,
} from '../services/attempts.service.js';

import { listStudentContent, getStudentContentDownloadUrl } from '../services/content.service.js';
import { getStudentGrades } from '../services/report.service.js';
import {
  completeTopic,
  getStudentTopic,
  listStudentTopics,
  assertTopicAccessible,
} from '../services/student-topics.service.js';
import { getStudentQuizAttachmentDownloadUrl } from '../services/quizzes.service.js';

const router = Router();

// All student routes require auth + student role
router.use(requireAuth, requireRole('admin', 'student'));

// POST /student/enrollments
router.post(
  '/enrollments',
  enrollLimiter,
  asyncHandler(async (req, res) => {
    const { joinCode } = enrollSchema.parse(req.body);
    const result = await enrollStudent(req.auth.profile.id, joinCode);
    res.status(201).json({ data: result });
  }),
);

// GET /student/subjects
router.get(
  '/subjects',
  asyncHandler(async (req, res) => {
    const subjects = await listStudentSubjects(req.auth.profile.id);
    res.json({ data: subjects });
  }),
);

// GET /student/subjects/:id
router.get(
  '/subjects/:id',
  requireEnrolled('id'),
  asyncHandler(async (req, res) => {
    const subject = req.subject;
    res.json({ data: subject });
  }),
);

// GET /student/subjects/:id/topics
router.get(
  '/subjects/:id/topics',
  requireEnrolled('id'),
  asyncHandler(async (req, res) => {
    const topics = await listStudentTopics(req.auth.profile.id, req.params.id);
    res.json({ data: topics });
  }),
);

// GET /student/subjects/:id/grades (RPT-03)
router.get(
  '/subjects/:id/grades',
  requireEnrolled('id'),
  asyncHandler(async (req, res) => {
    const grades = await getStudentGrades(req.auth.profile.id, req.params.id);
    res.json({ data: grades });
  }),
);

// GET /student/topics/:id
router.get(
  '/topics/:id',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const topic = await getStudentTopic(req.auth.profile.id, topicId);
    res.json({ data: topic });
  }),
);

// GET /student/topics/:id/content
router.get(
  '/topics/:id/content',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const blocks = await listStudentContent(req.auth.profile.id, topicId);
    res.json({ data: blocks });
  }),
);

// GET /student/content/:contentId/download-url
router.get(
  '/content/:contentId/download-url',
  asyncHandler(async (req, res) => {
    const contentId = uuidSchema.parse(req.params.contentId);
    const result = await getStudentContentDownloadUrl(req.auth.profile.id, contentId);
    res.json({ data: result });
  }),
);

router.post(
  '/topics/:id/complete',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const result = await completeTopic(req.auth.profile.id, topicId);
    res.json({ data: result });
  }),
);

// POST /student/quizzes/:id/attempts (built-in quiz start/resume)
router.post(
  '/quizzes/:id/attempts',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const result = await startAttempt(req.auth.profile.id, quizId);
    res.json({ data: result });
  }),
);

// POST /student/attempts/:id/submit (built-in quiz submit)
router.post(
  '/attempts/:id/submit',
  asyncHandler(async (req, res) => {
    const attemptId = uuidSchema.parse(req.params.id);
    const answers = req.body?.answers ?? req.body ?? [];
    const result = await submitAttempt(req.auth.profile.id, attemptId, answers);
    res.json({ data: result });
  }),
);

// GET /student/quizzes/:id/attempts
router.get(
  '/quizzes/:id/attempts',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const result = await getAttemptHistory(req.auth.profile.id, quizId);
    res.json({ data: result });
  }),
);

// ---------------------------------------------------------------------------
// Uploaded Quizzes (Phase 05)
// ---------------------------------------------------------------------------

// POST /student/quizzes/:id/uploads/upload-url (UPL-03)
router.post(
  '/quizzes/:id/uploads/upload-url',
  uploadUrlLimiter,
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const fileInfo = uploadUrlSchema.parse(req.body);
    const result = await getStudentUploadUrl(req.auth.profile.id, quizId, fileInfo);
    res.json({ data: result });
  }),
);

// POST /student/quizzes/:id/submissions (UPL-04)
router.post(
  '/quizzes/:id/submissions',
  submissionsLimiter,
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const input = submissionSchema.parse(req.body);
    const result = await createStudentSubmission(req.auth.profile.id, quizId, input);
    res.status(201).json({ data: result });
  }),
);

// DELETE /student/attempts/:id (UPL-05)
router.delete(
  '/attempts/:id',
  asyncHandler(async (req, res) => {
    const attemptId = uuidSchema.parse(req.params.id);
    const result = await deletePendingSubmission(req.auth.profile.id, attemptId);
    res.json({ data: result });
  }),
);

// GET /student/attempts/:id/image-url (UPL-05)
router.get(
  '/attempts/:id/image-url',
  asyncHandler(async (req, res) => {
    const attemptId = uuidSchema.parse(req.params.id);
    const result = await getStudentAttemptImageUrl(req.auth.profile.id, attemptId);
    res.json({ data: result });
  }),
);

// GET /student/quizzes/:id/attachment/download-url (UPL uploaded quiz attachment)
router.get(
  '/quizzes/:id/attachment/download-url',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const result = await getStudentQuizAttachmentDownloadUrl(
      req.auth.profile.id,
      quizId,
      assertTopicAccessible,
    );
    res.json({ data: result });
  }),
);

export default router;
