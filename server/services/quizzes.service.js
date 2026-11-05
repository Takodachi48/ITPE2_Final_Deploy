// server/services/quizzes.service.js
import { gradeAttempt } from './grading.js';
import { questionSchema } from '../validators/quiz.validator.js';
import { validateUpload } from '../utils/uploads.js';
import * as storageModule from '../lib/storage.js';

import { AppError } from '../lib/errors.js';
import * as quizzesRepoModule from '../repositories/quizzes.repository.js';
import * as topicsRepoModule from '../repositories/topics.repository.js';
import * as subjectsRepoModule from '../repositories/subjects.repository.js';

export const deps = {
  quizzesRepo: quizzesRepoModule,
  topicsRepo: topicsRepoModule,
  subjectsRepo: subjectsRepoModule,
  storage: storageModule,
  attemptsRepo: quizzesRepoModule,
};

export function setDeps(overrides) {
  if (overrides.quizzesRepo) deps.quizzesRepo = overrides.quizzesRepo;
  if (overrides.topicsRepo) deps.topicsRepo = overrides.topicsRepo;
  if (overrides.subjectsRepo) deps.subjectsRepo = overrides.subjectsRepo;
  if (overrides.storage) deps.storage = overrides.storage;
  if (overrides.attemptsRepo) deps.attemptsRepo = overrides.attemptsRepo;
}

async function checkTopicOwner(topicId, facultyId, isAdmin) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, 'NOT_FOUND', 'Topic not found.');
  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Topic not found.');
  }
  return { topic, subject };
}

export async function getQuiz(facultyId, topicId, isAdmin) {
  await checkTopicOwner(topicId, facultyId, isAdmin);
  return deps.quizzesRepo.findQuizByTopic(topicId);
}

export async function upsertQuizMeta(facultyId, topicId, data, isAdmin) {
  await checkTopicOwner(topicId, facultyId, isAdmin);

  const existing = await deps.quizzesRepo.findQuizByTopic(topicId);

  if (existing) {
    // mode locked once attempts exist
    if (data.mode !== undefined && data.mode !== existing.mode) {
      const has = await deps.quizzesRepo.hasAttempts(existing.id);
      if (has) {
        throw new AppError(409, 'QUIZ_HAS_ATTEMPTS', 'Quiz mode cannot change once attempts exist.');
      }
    }
    const updated = await deps.quizzesRepo.updateQuiz(existing.id, data);
    return updated;
  }

  // create
  const mode = data.mode || 'built';
  const title = data.title || 'Quiz';
  const created = await deps.quizzesRepo.createQuiz({
    topicId,
    title,
    mode,
    instructions: data.instructions,
    totalItems: data.totalItems,
    externalUrl: data.externalUrl,
    attachmentPath: data.attachmentPath,
    attachmentName: data.attachmentName,
    attachmentMime: data.attachmentMime,
    maxAttempts: data.maxAttempts,
    showAnswers: data.showAnswers,
    status: data.status,
  });
  return created;
}

export async function listQuestions(facultyId, quizId, isAdmin) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);
  return deps.quizzesRepo.listQuestionsByQuiz(quizId);
}

function genOptionId() {
  return Math.random().toString(36).slice(2, 10);
}

export async function createQuestion(facultyId, quizId, data, isAdmin) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);

  const count = await deps.quizzesRepo.countQuestions(quizId);
  if (count >= 20) {
    throw new AppError(422, "QUIZ_QUESTION_COUNT", "A quiz can have at most 20 questions.");
  }

  let options = null;
  let correctOptionId = null;
  if (data.type === "choice") {
    options = (data.options || []).map((o) => ({ id: genOptionId(), label: o.label }));
    if (typeof data.correctOptionIndex === "number" && options[data.correctOptionIndex]) {
      correctOptionId = options[data.correctOptionIndex].id;
    }
  }

  const position = count + 1;
  const created = await deps.quizzesRepo.createQuestion({
    quizId,
    position,
    type: data.type,
    prompt: data.prompt,
    options,
    correctOptionId,
    acceptedAnswers: data.acceptedAnswers || null,
    points: data.points,
  });
  return created;
}

export async function updateQuestion(facultyId, questionId, data, isAdmin) {
  const question = await deps.quizzesRepo.findQuestionById(questionId);
  if (!question) throw new AppError(404, "NOT_FOUND", "Question not found.");
  const quiz = await deps.quizzesRepo.findQuizById(question.quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);

  const updates = { ...data };

  // Choice questions: autosave payloads include options/correctOptionIndex (type may be omitted).
  const isChoice = question.type === "choice" || data.type === "choice";
  if (isChoice && (Array.isArray(data.options) || typeof data.correctOptionIndex === "number")) {
    let newOptions = question.options || [];
    if (Array.isArray(data.options)) {
      const prev = question.options || [];
      newOptions = data.options.map((o, idx) => {
        // preserve existing option id by index when labels change; fallback to label match; else generate
        const byIndex = prev[idx];
        const byLabel = prev.find((x) => x.label === o.label);
        return { id: (byIndex && byIndex.id) || (byLabel && byLabel.id) || genOptionId(), label: o.label };
      });
      updates.options = newOptions;
    }
    if (typeof data.correctOptionIndex === "number") {
      const idx = Math.max(0, Math.min((newOptions.length || 4) - 1, data.correctOptionIndex));
      const target = newOptions[idx];
      if (target) updates.correctOptionId = target.id;
    }
  }

  delete updates.correctOptionIndex;
  delete updates.type; // type changes not supported via this update path

  const updated = await deps.quizzesRepo.updateQuestion(questionId, updates);
  return updated;
}

export async function deleteQuestion(facultyId, questionId, isAdmin) {
  const question = await deps.quizzesRepo.findQuestionById(questionId);
  if (!question) throw new AppError(404, "NOT_FOUND", "Question not found.");
  const quiz = await deps.quizzesRepo.findQuizById(question.quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);

  // published built quiz cannot drop below 10
  if (quiz.status === "published" && quiz.mode === "built") {
    const count = await deps.quizzesRepo.countQuestions(quiz.id);
    if (count <= 10) {
      throw new AppError(422, "QUIZ_QUESTION_COUNT", "Cannot delete: published quiz must keep at least 10 questions.");
    }
  }

  await deps.quizzesRepo.deleteQuestion(questionId);
  return { deleted: true };
}

export async function reorderQuestions(facultyId, quizId, questionIds, isAdmin) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);
  await deps.quizzesRepo.reorderQuestions(quizId, questionIds);
  return deps.quizzesRepo.listQuestionsByQuiz(quizId);
}

export async function updateQuizStatus(facultyId, quizId, status, isAdmin) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);

  if (status === "published") {
    if (quiz.mode === "built") {
      const count = await deps.quizzesRepo.countQuestions(quizId);
      if (count < 10 || count > 20) {
        throw new AppError(422, "QUIZ_QUESTION_COUNT", "A built quiz needs 10 to 20 questions to publish.");
      }
    } else if (quiz.mode === "uploaded") {
      if (!quiz.totalItems || quiz.totalItems < 1) {
        throw new AppError(422, "QUIZ_QUESTION_COUNT", "An uploaded quiz needs totalItems to publish.");
      }
    }
  }

  const updated = await deps.quizzesRepo.updateQuiz(quizId, { status });
  return updated;
}

export async function importQuestions(facultyId, quizId, payload, isAdmin) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);

  const rows = Array.isArray(payload?.questions) ? payload.questions : [];
  const errors = [];
  const validated = [];
  rows.forEach((row, idx) => {
    const parsed = questionSchema.safeParse(row);
    if (!parsed.success) {
      errors.push({ row: idx + 1, issues: parsed.error.issues.map((i) => i.message) });
    } else {
      validated.push(parsed.data);
    }
  });
  if (errors.length > 0) {
    throw new AppError(422, "VALIDATION_ERROR", "One or more import rows are invalid.", errors);
  }

  const existing = await deps.quizzesRepo.countQuestions(quizId);
  if (existing + validated.length > 20) {
    throw new AppError(422, "QUIZ_QUESTION_COUNT", "Total questions would exceed 20.");
  }

  const items = validated.map((q) => {
    if (q.type === "choice") {
      const options = (q.options || []).map((o) => ({ id: genOptionId(), label: o.label }));
      let correctOptionId = null;
      if (typeof q.correctOptionIndex === "number" && options[q.correctOptionIndex]) {
        correctOptionId = options[q.correctOptionIndex].id;
      }
      return {
        type: q.type,
        prompt: q.prompt,
        options,
        correctOptionId,
        points: q.points,
      };
    }
    return {
      type: q.type,
      prompt: q.prompt,
      acceptedAnswers: q.acceptedAnswers,
      points: q.points,
    };
  });

  const created = await deps.quizzesRepo.createQuestionsBulk(quizId, items);
  return created;
}

export async function regradeQuiz(facultyId, quizId, isAdmin) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  await checkTopicOwner(quiz.topicId, facultyId, isAdmin);

  const questions = await deps.quizzesRepo.listQuestionsByQuiz(quizId);
  const allAttempts = await deps.quizzesRepo.listAllAttemptsByQuiz(quizId);

  let changed = 0;
  let total = 0;
  for (const attempt of allAttempts) {
    if (attempt.source !== "auto") continue;
    if (attempt.status !== "graded" && attempt.status !== "in_progress") continue;
    if (!attempt.answers) continue;
    total += 1;

    const raw = attempt.answers;
    const answers = Array.isArray(raw) ? raw : Array.isArray(raw?.answers) ? raw.answers : [];
    const answerMap = {};
    for (const a of answers) {
      if (a && a.questionId) {
        answerMap[a.questionId] = a.optionId !== undefined && a.optionId !== null ? a.optionId : a.text;
      }
    }

    const { score, total: tot } = gradeAttempt(questions, answerMap);
    const newScore = Math.round(score * 100) / 100;
    const newTotal = Math.round(tot * 100) / 100;
    if (newScore !== Number(attempt.score) || newTotal !== Number(attempt.total)) {
      await deps.quizzesRepo.updateAttempt(attempt.id, { score: newScore, total: newTotal });
      changed += 1;
    }
  }
  return { regraded: total, changed };
}

export async function getQuizAttachmentUploadUrl(facultyId, quizId, fileInfo, isAdmin) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  const { subject } = await checkTopicOwner(quiz.topicId, facultyId, isAdmin);

  const validation = validateUpload("quiz-attachment", fileInfo);
  if (!validation.ok) {
    throw new AppError(422, "UPLOAD_INVALID", validation.reason);
  }

  const path = deps.storage.buildObjectPath("quiz-attachment", {
    subjectId: subject.id,
    topicId: quiz.topicId,
  }, fileInfo.fileName);

  const uploadInfo = await deps.storage.createUploadUrl("topic-files", path);
  return { ...uploadInfo, path };
}

export async function getStudentQuizAttachmentDownloadUrl(studentId, quizId, topicAccess) {
  const quiz = await deps.quizzesRepo.findQuizById(quizId);
  if (!quiz) throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  if (quiz.status !== "published") throw new AppError(404, "NOT_FOUND", "Quiz not found.");
  if (!quiz.attachmentPath) throw new AppError(404, "NOT_FOUND", "Quiz attachment not found.");

  await topicAccess(studentId, quiz.topicId);

  const url = await deps.storage.createDownloadUrl("topic-files", quiz.attachmentPath, 120);
  return { url, expiresAt: new Date(Date.now() + 120 * 1000).toISOString() };
}
