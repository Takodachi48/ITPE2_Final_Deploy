// server/services/attempts.service.js
import { gradeAttempt, isPassed, computePercent, gradeQuestion } from './grading.js';
import { validateUpload, checkImageMagicBytes } from '../utils/uploads.js';
import * as storageModule from '../lib/storage.js';

import { AppError } from '../lib/errors.js';
import * as attemptsRepoModule from '../repositories/quizzes.repository.js';
import * as quizzesRepoModule from '../repositories/quizzes.repository.js';
import * as topicsRepoModule from '../repositories/topics.repository.js';
import * as subjectsRepoModule from '../repositories/subjects.repository.js';
import { assertTopicAccessible } from './student-topics.service.js';

export const deps = {
  attemptsRepo: attemptsRepoModule,
  quizzesRepo: quizzesRepoModule,
  topicsRepo: topicsRepoModule,
  subjectsRepo: subjectsRepoModule,
  storage: storageModule,
  assertTopicAccessible: null,
};

export function setDeps(overrides) {
  if (overrides.attemptsRepo) deps.attemptsRepo = overrides.attemptsRepo;
  if (overrides.quizzesRepo) deps.quizzesRepo = overrides.quizzesRepo;
  if (overrides.topicsRepo) deps.topicsRepo = overrides.topicsRepo;
  if (overrides.subjectsRepo) deps.subjectsRepo = overrides.subjectsRepo;
  if (overrides.storage) deps.storage = overrides.storage;
  if (overrides.assertTopicAccessible) deps.assertTopicAccessible = overrides.assertTopicAccessible;
}

function stripKeys(question) {
  if (!question) return question;
  const q = { ...question };
  delete q.correctOptionId;
  delete q.acceptedAnswers;
  if (Array.isArray(q.options)) {
    q.options = q.options.map((o) => ({ id: o?.id ?? o?.optionId ?? null, label: o?.label ?? "" }));
  }
  return q;
}

export async function startAttempt(studentId, quizId) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
  if (quiz.status !== 'published') {
    throw new AppError(403, 'QUIZ_NOT_PUBLISHED', 'This quiz is not published.');
  }

  const topic = await deps.topicsRepo.findTopicById(quiz.topicId);
  if (!topic) throw new AppError(404, 'NOT_FOUND', 'Topic not found.');
  if (topic.status !== 'published') throw new AppError(404, 'NOT_FOUND', 'Topic not found.');

  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');

  const enrollment = await deps.subjectsRepo.findEnrollment(subject.id, studentId);
  if (!enrollment || enrollment.status !== 'active') {
    throw new AppError(403, 'NOT_ENROLLED', 'You are not enrolled in this subject.');
  }

  if (deps.assertTopicAccessible) {
    await deps.assertTopicAccessible(studentId, quiz.topicId);
  } else if (deps.topicsRepo !== topicsRepoModule && !deps.topicsRepo.listTopicsBySubject) {
    const availableFrom = new Date(topic.availableFrom);
    if (new Date() < availableFrom) {
      throw new AppError(403, 'TOPIC_NOT_AVAILABLE', 'This topic is not available yet.');
    }
  } else {
    await assertTopicAccessible(studentId, quiz.topicId);
  }

  // resume in_progress
  const inProgress = await deps.attemptsRepo.findInProgressAttempt(quizId, studentId);
  if (inProgress) {
    const questions = await deps.quizzesRepo.listQuestionsByQuiz(quizId);
    return { attempt: inProgress, questions: questions.map(stripKeys) };
  }

  // max attempts (only when starting a new attempt)
  const count = await deps.attemptsRepo.countAttempts(quizId, studentId);
  if (quiz.maxAttempts && count >= quiz.maxAttempts) {
    throw new AppError(409, 'MAX_ATTEMPTS_REACHED', 'Maximum attempts reached.');
  }

  // new attempt
  const attemptNo = count + 1;
  const attempt = await deps.attemptsRepo.createAttempt({
    quizId,
    studentId,
    attemptNo,
    source: 'auto',
    status: 'in_progress',
    answers: null,
  });
  const questions = await deps.quizzesRepo.listQuestionsByQuiz(quizId);
  return { attempt, questions: questions.map(stripKeys) };
}

export async function submitAttempt(studentId, attemptId, answersPayload) {
  const attempt = await deps.attemptsRepo.findAttemptById(attemptId);
  if (!attempt) throw new AppError(404, "NOT_FOUND", "Attempt not found.");
  if (attempt.studentId !== studentId) throw new AppError(404, "NOT_FOUND", "Attempt not found.");
  if (attempt.status !== "in_progress") {
    throw new AppError(409, "ATTEMPT_ALREADY_SUBMITTED", "This attempt has already been submitted.");
  }

  const quiz = await deps.quizzesRepo.findQuizById(attempt.quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");

  if (deps.assertTopicAccessible) {
    await deps.assertTopicAccessible(studentId, quiz.topicId);
  } else if (deps.topicsRepo === topicsRepoModule || deps.topicsRepo.listTopicsBySubject) {
    await assertTopicAccessible(studentId, quiz.topicId);
  }

  const topic = await deps.topicsRepo.findTopicById(quiz.topicId);
  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  const passingPercent = subject.passingPercent;

  const questions = await deps.quizzesRepo.listQuestionsByQuiz(quiz.id);

  // Build answers map for grading
  const answers = Array.isArray(answersPayload) ? answersPayload : (answersPayload?.answers || []);
  const answerMap = {};
  for (const a of answers) {
    if (a && a.questionId) {
      answerMap[a.questionId] = a.optionId !== undefined ? a.optionId : a.text;
    }
  }

  const { score, total } = gradeAttempt(questions, answerMap);
  const passed = isPassed(score, total, passingPercent);
  const percent = computePercent(score, total);

  await deps.attemptsRepo.updateAttempt(attemptId, {
    status: "graded",
    answers,
    score,
    total,
    submittedAt: new Date().toISOString(),
  });

  const response = { score, total, percent, passed, passingPercent };
  if (quiz.showAnswers) {
    response.review = questions.map((q) => {
      const ans = answerMap[q.id];
      return { questionId: q.id, correct: gradeQuestion(q, ans) > 0 };
    });
  }
  return response;
}

export async function getAttemptHistory(studentId, quizId) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");

  const topic = await deps.topicsRepo.findTopicById(quiz.topicId);
  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  const passingPercent = subject.passingPercent;

  const attempts = await deps.attemptsRepo.listAttemptsByStudentQuiz(quizId, studentId);

  // best = graded attempt with highest percent (ties: latest)
  let best = null;
  for (const a of attempts) {
    if (a.status !== "graded" || a.score === null || a.total === null) continue;
    const pct = a.total > 0 ? (a.score / a.total) * 100 : 0;
    if (!best) { best = { attempt: a, percent: pct }; continue; }
    const bestPct = best.attempt.total > 0 ? (best.attempt.score / best.attempt.total) * 100 : 0;
    if (pct > bestPct || (pct === bestPct && new Date(a.submittedAt || a.startedAt) > new Date(best.attempt.submittedAt || best.attempt.startedAt))) {
      best = { attempt: a, percent: pct };
    }
  }

  const passed = best ? isPassed(best.attempt.score, best.attempt.total, passingPercent) : false;

  return {
    attempts,
    best: best ? best.attempt : null,
    bestPercent: best ? Math.round(best.percent * 100) / 100 : null,
    passed,
    passingPercent,
  };
}

// ---------------------------------------------------------------------------
// Uploaded Quizzes (Phase 05)
// ---------------------------------------------------------------------------

export async function getStudentUploadUrl(studentId, quizId, fileInfo) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
  if (quiz.mode !== 'uploaded') {
    throw new AppError(400, 'BAD_REQUEST', 'This quiz does not accept uploaded files.');
  }
  if (quiz.status !== 'published') {
    throw new AppError(403, 'QUIZ_NOT_PUBLISHED', 'This quiz is not published.');
  }

  let subject;
  if (deps.assertTopicAccessible) {
    const res = await deps.assertTopicAccessible(studentId, quiz.topicId);
    subject = res?.subject;
  } else if (deps.topicsRepo !== topicsRepoModule && !deps.topicsRepo.listTopicsBySubject) {
    const topic = await deps.topicsRepo.findTopicById(quiz.topicId);
    subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  } else {
    const res = await assertTopicAccessible(studentId, quiz.topicId);
    subject = res?.subject;
  }

  const count = await deps.attemptsRepo.countAttempts(quizId, studentId);
  if (quiz.maxAttempts && count >= quiz.maxAttempts) {
    throw new AppError(409, 'MAX_ATTEMPTS_REACHED', 'Maximum attempts reached.');
  }

  const validation = validateUpload('score-image', fileInfo);
  if (!validation.ok) {
    throw new AppError(422, 'UPLOAD_INVALID', validation.reason);
  }

  const path = deps.storage.buildObjectPath(
    'quiz-upload',
    { subjectId: subject.id, quizId, studentId },
    fileInfo.fileName,
  );

  const uploadInfo = await deps.storage.createUploadUrl('quiz-uploads', path);
  return { ...uploadInfo, path };
}

export async function createStudentSubmission(studentId, quizId, { path }) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
  if (quiz.mode !== 'uploaded') {
    throw new AppError(400, 'BAD_REQUEST', 'This quiz does not accept uploaded files.');
  }
  if (quiz.status !== 'published') {
    throw new AppError(403, 'QUIZ_NOT_PUBLISHED', 'This quiz is not published.');
  }

  let subject;
  if (deps.assertTopicAccessible) {
    const res = await deps.assertTopicAccessible(studentId, quiz.topicId);
    subject = res?.subject;
  } else if (deps.topicsRepo !== topicsRepoModule && !deps.topicsRepo.listTopicsBySubject) {
    const topic = await deps.topicsRepo.findTopicById(quiz.topicId);
    subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  } else {
    const res = await assertTopicAccessible(studentId, quiz.topicId);
    subject = res?.subject;
  }

  // Pending review guard
  const pending = await deps.attemptsRepo.findPendingReviewAttempt(quizId, studentId);
  if (pending) {
    throw new AppError(409, 'PENDING_REVIEW_EXISTS', 'You already have a submission pending review.');
  }

  // Max attempts guard
  const count = await deps.attemptsRepo.countAttempts(quizId, studentId);
  if (quiz.maxAttempts && count >= quiz.maxAttempts) {
    throw new AppError(409, 'MAX_ATTEMPTS_REACHED', 'Maximum attempts reached.');
  }

  // Path prefix verification
  const expectedPrefix = `subjects/${subject.id}/quizzes/${quizId}/${studentId}/`;
  if (!path || !path.startsWith(expectedPrefix)) {
    try {
      await deps.storage.removeObject('quiz-uploads', path);
    } catch {
      // Ignore storage errors: the upload is rejected either way.
    }
    throw new AppError(422, 'UPLOAD_INVALID', 'Upload path prefix is invalid.');
  }

  // Storage object existence
  const info = await deps.storage.objectInfo('quiz-uploads', path);
  if (!info) {
    throw new AppError(422, 'UPLOAD_INVALID', 'Uploaded file was not found in storage.');
  }

  // Magic bytes check (if downloadObject exists)
  if (deps.storage.downloadObject) {
    try {
      const buffer = await deps.storage.downloadObject('quiz-uploads', path);
      if (buffer) {
        const magic = checkImageMagicBytes(buffer);
        if (!magic) {
          try {
            await deps.storage.removeObject('quiz-uploads', path);
          } catch {
            // Ignore storage errors: the upload is rejected either way.
          }
          throw new AppError(422, 'UPLOAD_INVALID', 'Uploaded file is not a valid image (JPEG/PNG/WebP).');
        }
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
    }
  }

  const attemptNo = count + 1;
  const attempt = await deps.attemptsRepo.createAttempt({
    quizId,
    studentId,
    attemptNo,
    source: 'manual',
    status: 'pending_review',
    imagePath: path,
    submittedAt: new Date().toISOString(),
  });

  return attempt;
}

export async function deletePendingSubmission(studentId, attemptId) {
  const attempt = await deps.attemptsRepo.findAttemptById(attemptId);
  if (!attempt || attempt.studentId !== studentId) {
    throw new AppError(404, 'NOT_FOUND', 'Attempt not found.');
  }

  if (attempt.status !== 'pending_review') {
    throw new AppError(409, 'CONFLICT', 'Only submissions pending review can be removed.');
  }

  if (attempt.imagePath) {
    try {
      await deps.storage.removeObject('quiz-uploads', attempt.imagePath);
    } catch {
      // Ignore storage errors: the attempt record is removed regardless.
    }
  }

  await deps.attemptsRepo.deleteAttempt(attemptId);
  return { deleted: true };
}

export async function getStudentAttemptImageUrl(studentId, attemptId) {
  const attempt = await deps.attemptsRepo.findAttemptById(attemptId);
  if (!attempt || attempt.studentId !== studentId) {
    throw new AppError(404, 'NOT_FOUND', 'Attempt not found.');
  }

  if (!attempt.imagePath) {
    throw new AppError(404, 'NOT_FOUND', 'No submission image found.');
  }

  const url = await deps.storage.createDownloadUrl('quiz-uploads', attempt.imagePath, 120);
  return { url };
}

export async function listSubmissions(facultyId, subjectId, query, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  return deps.attemptsRepo.listSubmissionsBySubject(subjectId, query);
}

export async function getFacultyAttemptDetail(facultyId, attemptId, isAdmin) {
  const ctx = await deps.attemptsRepo.findAttemptWithContext(attemptId);
  if (!ctx) throw new AppError(404, 'NOT_FOUND', 'Attempt not found.');
  if (!isAdmin && ctx.subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Attempt not found.');
  }

  let imageUrl = null;
  if (ctx.attempt.imagePath) {
    imageUrl = await deps.storage.createDownloadUrl('quiz-uploads', ctx.attempt.imagePath, 300);
  }

  return {
    attempt: ctx.attempt,
    imageUrl,
    totalItems: ctx.quiz.totalItems,
    quiz: ctx.quiz,
    student: ctx.student,
    topic: ctx.topic,
  };
}

export async function gradeManualAttempt(facultyId, attemptId, { score, feedback }, isAdmin) {
  const ctx = await deps.attemptsRepo.findAttemptWithContext(attemptId);
  if (!ctx) throw new AppError(404, 'NOT_FOUND', 'Attempt not found.');
  if (!isAdmin && ctx.subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Attempt not found.');
  }

  const total = ctx.quiz.totalItems;
  if (total === null || total === undefined || total < 1) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Quiz has no totalItems set.');
  }

  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore < 0 || numScore > total) {
    throw new AppError(422, 'VALIDATION_ERROR', `Score must be between 0 and ${total}.`);
  }

  if (Math.round(numScore * 100) / 100 !== numScore) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Score can have at most 2 decimal places.');
  }

  const roundedScore = Math.round(numScore * 100) / 100;
  const updated = await deps.attemptsRepo.updateAttempt(attemptId, {
    status: 'graded',
    score: roundedScore,
    total: total,
    feedback: feedback !== undefined ? feedback : null,
    gradedBy: facultyId,
    gradedAt: new Date().toISOString(),
  });

  const passed = isPassed(roundedScore, total, ctx.subject.passingPercent);
  const percent = computePercent(roundedScore, total);

  return {
    attempt: updated,
    score: roundedScore,
    total,
    percent,
    passed,
    passingPercent: ctx.subject.passingPercent,
  };
}
