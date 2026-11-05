// server/routes/faculty.routes.js
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireApproved, requireRole, requireSubjectOwner } from '../middleware/auth.js';
import {
  archiveSubject,
  createSubject,
  getSubject,
  getRoster,
  listFacultySubjects,
  listAllFacultySubjects,
  regenerateJoinCode,
  removeStudent,
  toggleEnrollment,
  updateSubject,
} from '../services/subjects.service.js';
import {
  bulkCreateTopics,
  createTopic,
  deleteTopic,
  listTopics,
  reorderTopics,
  updateTopic,
} from '../services/topics.service.js';
import {
  createContentBlock,
  deleteContentBlock,
  getUploadUrl,
  listContent,
  reorderContentBlocks,
  updateContentBlock,
} from '../services/content.service.js';
import {
  createQuestion,
  deleteQuestion,
  getQuiz,
  importQuestions,
  listQuestions,
  regradeQuiz,
  reorderQuestions,
  updateQuestion,
  updateQuizStatus,
  upsertQuizMeta,
  getQuizAttachmentUploadUrl,
} from '../services/quizzes.service.js';
import {
  listPptSources,
  previewGeneratedQuiz,
  saveGeneratedQuiz,
} from '../services/quiz-generation.service.js';
import {
  getSubjectReport,
  getStudentScores,
} from '../services/report.service.js';
import { getFacultyProgress } from '../services/progress.service.js';
import {
  listSubmissions,
  getFacultyAttemptDetail,
  gradeManualAttempt,
} from '../services/attempts.service.js';

import { aiGenerationLimiter } from '../middleware/rateLimit.js';
import {
  contentBlockSchema,
  updateContentBlockSchema,
} from '../validators/content.validator.js';
import {
  createTopicSchema,
  updateTopicSchema,
  bulkTopicsSchema,
  reorderTopicsSchema,
} from '../validators/topic.validator.js';
import {
  createSubjectSchema,
  updateSubjectSchema,
} from '../validators/subject.validator.js';
import { uuidSchema } from '../validators/common.js';
import {
  createQuestionSchema,
  updateQuestionSchema,
  gradeAttemptSchema,
  uploadUrlSchema,
  generateQuizPreviewSchema,
  saveGeneratedQuizSchema,
} from '../validators/quiz.validator.js';

const router = Router();

// All faculty routes require auth + approved + faculty role
router.use(requireAuth, requireApproved, requireRole('admin', 'faculty'));

// GET /faculty/subjects?status=active
router.get(
  '/subjects',
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    const isAdmin = req.auth.profile?.role === 'admin';
    const subjects = isAdmin
      ? await listAllFacultySubjects(status)
      : await listFacultySubjects(req.auth.profile.id, status);

    const { countStudents } = await import('../repositories/subjects.repository.js');
    const withCounts = await Promise.all(
      subjects.map(async (s) => ({
        ...s,
        studentCount: await countStudents(s.id),
      })),
    );
    res.json({ data: withCounts });
  }),
);

// POST /faculty/subjects
router.post(
  '/subjects',
  asyncHandler(async (req, res) => {
    const input = createSubjectSchema.parse(req.body);
    const subject = await createSubject(req.auth.profile.id, input);
    res.status(201).json({ data: subject });
  }),
);

// GET /faculty/subjects/:id
router.get(
  '/subjects/:id',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth.profile?.role === 'admin';
    const subject = await getSubject(req.auth.profile.id, req.params.id, isAdmin);
    res.json({ data: subject });
  }),
);

// PATCH /faculty/subjects/:id
router.patch(
  '/subjects/:id',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const input = updateSubjectSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const subject = await updateSubject(req.auth.profile.id, req.params.id, input, isAdmin);
    res.json({ data: subject });
  }),
);

// POST /faculty/subjects/:id/join-code (regenerate)
router.post(
  '/subjects/:id/join-code',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth.profile?.role === 'admin';
    const subject = await regenerateJoinCode(req.auth.profile.id, req.params.id, isAdmin);
    res.json({ data: subject });
  }),
);

// GET /faculty/subjects/:id/students (roster)
router.get(
  '/subjects/:id/students',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const roster = await getRoster(req.params.id);
    res.json({ data: roster });
  }),
);

// DELETE /faculty/subjects/:id/students/:studentId (remove student)
router.delete(
  '/subjects/:id/students/:studentId',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const studentId = uuidSchema.parse(req.params.studentId);
    const isAdmin = req.auth.profile?.role === 'admin';
    const enrollment = await removeStudent(req.auth.profile.id, req.params.id, studentId, isAdmin);
    res.json({ data: enrollment });
  }),
);

// PATCH /faculty/subjects/:id/archive
router.patch(
  '/subjects/:id/archive',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth.profile?.role === 'admin';
    const subject = await archiveSubject(req.auth.profile.id, req.params.id, isAdmin);
    res.json({ data: subject });
  }),
);

// PATCH /faculty/subjects/:id/enrollment (toggle open/close)
router.patch(
  '/subjects/:id/enrollment',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const { open } = z.object({ open: z.boolean() }).parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const subject = await toggleEnrollment(req.auth.profile.id, req.params.id, open, isAdmin);
    res.json({ data: subject });
  }),
);

// GET /faculty/subjects/:id/topics
router.get(
  '/subjects/:id/topics',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth.profile?.role === 'admin';
    const topics = await listTopics(req.auth.profile.id, req.params.id, isAdmin);
    res.json({ data: topics });
  }),
);

// POST /faculty/subjects/:id/topics
router.post(
  '/subjects/:id/topics',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const input = createTopicSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const topic = await createTopic(req.auth.profile.id, req.params.id, input, isAdmin);
    res.status(201).json({ data: topic });
  }),
);

// POST /faculty/subjects/:id/topics/bulk
router.post(
  '/subjects/:id/topics/bulk',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const input = bulkTopicsSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const topics = await bulkCreateTopics(req.auth.profile.id, req.params.id, input, isAdmin);
    res.status(201).json({ data: topics });
  }),
);

// PUT /faculty/subjects/:id/topics/order
router.put(
  '/subjects/:id/topics/order',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const { topicIds } = reorderTopicsSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const topics = await reorderTopics(req.auth.profile.id, req.params.id, topicIds, isAdmin);
    res.json({ data: topics });
  }),
);

// GET /faculty/topics/:id
router.get(
  '/topics/:id',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const { getFacultyTopic } = await import('../services/topics.service.js');
    const topic = await getFacultyTopic(req.auth.profile.id, topicId, isAdmin);
    res.json({ data: topic });
  }),
);

// PATCH /faculty/topics/:id
router.patch(
  '/topics/:id',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const input = updateTopicSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const updated = await updateTopic(req.auth.profile.id, topicId, input, isAdmin);
    res.json({ data: updated });
  }),
);

// DELETE /faculty/topics/:id
router.delete(
  '/topics/:id',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await deleteTopic(req.auth.profile.id, topicId, isAdmin);
    res.json({ data: result });
  }),
);

// GET /faculty/topics/:id/content
router.get(
  '/topics/:id/content',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const blocks = await listContent(req.auth.profile.id, topicId, isAdmin);
    res.json({ data: blocks });
  }),
);

// POST /faculty/topics/:id/content
router.post(
  '/topics/:id/content',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const input = contentBlockSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const block = await createContentBlock(req.auth.profile.id, topicId, input, isAdmin);
    res.status(201).json({ data: block });
  }),
);

// PATCH /faculty/content/:id
router.patch(
  '/content/:id',
  asyncHandler(async (req, res) => {
    const blockId = uuidSchema.parse(req.params.id);
    const input = updateContentBlockSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const block = await updateContentBlock(req.auth.profile.id, blockId, input, isAdmin);
    res.json({ data: block });
  }),
);

// DELETE /faculty/content/:id
router.delete(
  '/content/:id',
  asyncHandler(async (req, res) => {
    const blockId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await deleteContentBlock(req.auth.profile.id, blockId, isAdmin);
    res.json({ data: result });
  }),
);

// PUT /faculty/topics/:id/content/order
router.put(
  '/topics/:id/content/order',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const { blockIds } = z.object({ blockIds: z.array(uuidSchema) }).parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const blocks = await reorderContentBlocks(req.auth.profile.id, topicId, blockIds, isAdmin);
    res.json({ data: blocks });
  }),
);

// POST /faculty/topics/:id/content/upload-url
router.post(
  '/topics/:id/content/upload-url',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const { fileName, mime, size, kind } = z.object({
      fileName: z.string().min(1),
      mime: z.string().min(1),
      size: z.number().int().positive(),
      kind: z.string().optional().default('presentation'),
    }).parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await getUploadUrl(req.auth.profile.id, topicId, kind, { fileName, mime, size }, isAdmin);
    res.json({ data: result });
  }),
);

// GET /faculty/topics/:id/ppt-sources
router.get(
  '/topics/:id/ppt-sources',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const sources = await listPptSources(req.auth.profile.id, topicId, isAdmin);
    res.json({ data: sources });
  }),
);

// POST /faculty/topics/:id/quiz/generate-preview
router.post(
  '/topics/:id/quiz/generate-preview',
  aiGenerationLimiter,
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const input = generateQuizPreviewSchema.parse(req.body || {});
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await previewGeneratedQuiz(req.auth.profile.id, topicId, input, isAdmin);
    res.json({ data: result });
  }),
);

// POST /faculty/topics/:id/quiz/save-generated
router.post(
  '/topics/:id/quiz/save-generated',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const input = saveGeneratedQuizSchema.parse(req.body || {});
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await saveGeneratedQuiz(req.auth.profile.id, topicId, input, isAdmin);
    res.json({ data: result });
  }),
);

// GET /faculty/topics/:id/quiz
router.get(
  '/topics/:id/quiz',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const quiz = await getQuiz(req.auth.profile.id, topicId, isAdmin);
    res.json({ data: quiz });
  }),
);

// PUT /faculty/topics/:id/quiz
router.put(
  '/topics/:id/quiz',
  asyncHandler(async (req, res) => {
    const topicId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const quiz = await upsertQuizMeta(req.auth.profile.id, topicId, req.body || {}, isAdmin);
    res.json({ data: quiz });
  }),
);


// GET /faculty/quizzes/:id/questions
router.get(
  '/quizzes/:id/questions',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const questions = await listQuestions(req.auth.profile.id, quizId, isAdmin);
    res.json({ data: questions });
  }),
);

// POST /faculty/quizzes/:id/questions
router.post(
  '/quizzes/:id/questions',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const input = createQuestionSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const question = await createQuestion(req.auth.profile.id, quizId, input, isAdmin);
    res.status(201).json({ data: question });
  }),
);

// PATCH /faculty/questions/:id
router.patch(
  '/questions/:id',
  asyncHandler(async (req, res) => {
    const questionId = uuidSchema.parse(req.params.id);
    const input = updateQuestionSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const question = await updateQuestion(req.auth.profile.id, questionId, input, isAdmin);
    res.json({ data: question });
  }),
);

// DELETE /faculty/questions/:id
router.delete(
  '/questions/:id',
  asyncHandler(async (req, res) => {
    const questionId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await deleteQuestion(req.auth.profile.id, questionId, isAdmin);
    res.json({ data: result });
  }),
);

// PUT /faculty/quizzes/:id/questions/order
router.put(
  '/quizzes/:id/questions/order',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const { questionIds } = z.object({ questionIds: z.array(uuidSchema) }).parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const questions = await reorderQuestions(req.auth.profile.id, quizId, questionIds, isAdmin);
    res.json({ data: questions });
  }),
);


// PATCH /faculty/quizzes/:id
router.patch(
  '/quizzes/:id',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const { status } = z.object({ status: z.enum(['draft', 'published']) }).parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const quiz = await updateQuizStatus(req.auth.profile.id, quizId, status, isAdmin);
    res.json({ data: quiz });
  }),
);


// POST /faculty/quizzes/:id/questions/import
router.post(
  '/quizzes/:id/questions/import',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const questions = await importQuestions(req.auth.profile.id, quizId, req.body, isAdmin);
    res.status(201).json({ data: questions });
  }),
);


// POST /faculty/quizzes/:id/regrade
router.post(
  '/quizzes/:id/regrade',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await regradeQuiz(req.auth.profile.id, quizId, isAdmin);
    res.json({ data: result });
  }),
);



// POST /faculty/quizzes/:id/attachment/upload-url (UPL-02)
router.post(
  '/quizzes/:id/attachment/upload-url',
  asyncHandler(async (req, res) => {
    const quizId = uuidSchema.parse(req.params.id);
    const fileInfo = uploadUrlSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await getQuizAttachmentUploadUrl(req.auth.profile.id, quizId, fileInfo, isAdmin);
    res.json({ data: result });
  }),
);

// GET /faculty/subjects/:id/submissions (UPL-06)
router.get(
  '/subjects/:id/submissions',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth.profile?.role === 'admin';
    const status = req.query.status;
    const q = req.query.q;
    const submissions = await listSubmissions(req.auth.profile.id, req.params.id, { status, q }, isAdmin);
    res.json({ data: submissions });
  }),
);

// GET /faculty/attempts/:id (UPL-06)
router.get(
  '/attempts/:id',
  asyncHandler(async (req, res) => {
    const attemptId = uuidSchema.parse(req.params.id);
    const isAdmin = req.auth.profile?.role === 'admin';
    const detail = await getFacultyAttemptDetail(req.auth.profile.id, attemptId, isAdmin);
    res.json({ data: detail });
  }),
);

// PATCH /faculty/attempts/:id/grade (UPL-07)
router.patch(
  '/attempts/:id/grade',
  asyncHandler(async (req, res) => {
    const attemptId = uuidSchema.parse(req.params.id);
    const input = gradeAttemptSchema.parse(req.body);
    const isAdmin = req.auth.profile?.role === 'admin';
    const result = await gradeManualAttempt(req.auth.profile.id, attemptId, input, isAdmin);
    res.json({ data: result });
  }),
);


// GET /faculty/subjects/:id/report (RPT-01)
router.get(
  '/subjects/:id/report',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth.profile?.role === 'admin';
    const sort = req.query.sort || 'surname';
    const dir = req.query.dir || 'asc';
    const report = await getSubjectReport(req.auth.profile.id, req.params.id, { sort, dir }, isAdmin);
    res.json({ data: report });
  }),
);

// GET /faculty/subjects/:id/students/:studentId/scores (RPT-02)
router.get(
  '/subjects/:id/students/:studentId/scores',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const studentId = uuidSchema.parse(req.params.studentId);
    const isAdmin = req.auth.profile?.role === 'admin';
    const scores = await getStudentScores(req.auth.profile.id, req.params.id, studentId, isAdmin);
    res.json({ data: scores });
  }),
);

// GET /faculty/subjects/:id/progress (GATE-06)
router.get(
  '/subjects/:id/progress',
  requireSubjectOwner('id'),
  asyncHandler(async (req, res) => {
    const isAdmin = req.auth.profile?.role === 'admin';
    const progress = await getFacultyProgress(req.auth.profile.id, req.params.id, isAdmin);
    res.json({ data: progress });
  }),
);

export default router;