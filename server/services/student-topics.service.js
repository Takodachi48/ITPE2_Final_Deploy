// server/services/student-topics.service.js
import { AppError } from "../lib/errors.js";
import { computeTopicStates, isTopicAccessible } from "./progress.service.js";
import { isPassed } from "./grading.js";
import * as topicsRepoModule from "../repositories/topics.repository.js";
import * as subjectsRepoModule from "../repositories/subjects.repository.js";
import * as progressRepoModule from "../repositories/progress.repository.js";
import * as quizzesRepoModule from "../repositories/quizzes.repository.js";

export const deps = {
  topicsRepo: topicsRepoModule,
  subjectsRepo: subjectsRepoModule,
  progressRepo: progressRepoModule,
  quizzesRepo: quizzesRepoModule,
};

export function setDeps(overrides) {
  if (overrides.topicsRepo) deps.topicsRepo = overrides.topicsRepo;
  if (overrides.subjectsRepo) deps.subjectsRepo = overrides.subjectsRepo;
  if (overrides.progressRepo) deps.progressRepo = overrides.progressRepo;
  if (overrides.quizzesRepo) deps.quizzesRepo = overrides.quizzesRepo;
}

/**
 * Load all gating data and compute topic states for a student in a subject.
 */
async function loadStates(studentId, subjectId) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  if (!subject) throw new AppError(404, "NOT_FOUND", "Subject not found.");

  const enrollment = await deps.subjectsRepo.findEnrollment(subjectId, studentId);
  if (!enrollment || enrollment.status !== "active") {
    throw new AppError(403, "NOT_ENROLLED", "You are not enrolled in this subject.");
  }

  const topics = await deps.topicsRepo.listTopicsBySubject(subjectId);
  const published = topics.filter((t) => t.status === "published");

  const [quizByTopicId, attempts, progressTopicIds] = await Promise.all([
    deps.progressRepo.listPublishedQuizzesBySubject(subjectId),
    deps.progressRepo.listAttemptsByStudentSubject(subjectId, studentId),
    deps.progressRepo.listProgressByStudentSubject(subjectId, studentId),
  ]);

  const now = new Date();
  const states = computeTopicStates({
    topics: published,
    quizByTopicId,
    attempts,
    progressTopicIds,
    passingPercent: subject.passingPercent,
    now,
  });

  return { subject, states, attempts };
}

export async function listStudentTopics(studentId, subjectId) {
  const { states } = await loadStates(studentId, subjectId);
  return states;
}

export async function getStudentTopic(studentId, topicId) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found.");
  if (topic.status !== "published") {
    throw new AppError(404, "NOT_FOUND", "Topic not found.");
  }

  const { subject, states, attempts } = await loadStates(studentId, topic.subjectId);
  const topicState = states.find((s) => s.id === topicId);

  if (!topicState) {
    throw new AppError(404, "NOT_FOUND", "Topic not found.");
  }

  if (!isTopicAccessible(topicState.state)) {
    if (topicState.state === "scheduled") {
      throw new AppError(403, "TOPIC_NOT_AVAILABLE", "This topic is not available yet.", {
        availableFrom: topicState.availableFrom,
      });
    }
    throw new AppError(403, "TOPIC_LOCKED", topicState.reason || "This topic is locked.", {
      blockedByTopicId: topicState.blockedByTopicId,
    });
  }

  let quiz = null;
  let topicAttempts = [];
  if (deps.quizzesRepo && deps.quizzesRepo.findQuizByTopic) {
    const q = await deps.quizzesRepo.findQuizByTopic(topicId);
    if (q && q.status === "published") {
      quiz = {
        id: q.id,
        title: q.title,
        mode: q.mode,
        totalItems: q.totalItems,
        instructions: q.instructions,
        maxAttempts: q.maxAttempts,
        showAnswers: q.showAnswers,
        externalUrl: q.externalUrl,
        attachmentPath: q.attachmentPath,
        attachmentName: q.attachmentName,
        attachmentMime: q.attachmentMime,
      };
      topicAttempts = attempts
        .filter((a) => a.quizId === q.id)
        .sort((a, b) => b.attemptNo - a.attemptNo)
        .map((a) => ({
          ...a,
          passed:
            a.status === "graded" &&
            Number.isFinite(a.score) &&
            Number.isFinite(a.total) &&
            a.total > 0
              ? isPassed(a.score, a.total, subject.passingPercent)
              : null,
        }));
    }
  }

  return { ...topicState, quiz, attempts: topicAttempts };
}

/**
 * Assert a topic is accessible for student actions (quiz start, upload, etc.).
 * Returns { topic, subject, topicState }.
 */
export async function assertTopicAccessible(studentId, topicId) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found.");
  if (topic.status !== "published") {
    throw new AppError(404, "NOT_FOUND", "Topic not found.");
  }

  const { subject, states } = await loadStates(studentId, topic.subjectId);
  const topicState = states.find((s) => s.id === topicId);

  if (!topicState || !isTopicAccessible(topicState.state)) {
    if (topicState?.state === "scheduled") {
      throw new AppError(403, "TOPIC_NOT_AVAILABLE", "This topic is not available yet.", {
        availableFrom: topicState.availableFrom,
      });
    }
    throw new AppError(403, "TOPIC_LOCKED", topicState?.reason || "This topic is locked.", {
      blockedByTopicId: topicState?.blockedByTopicId,
    });
  }

  return { topic, subject, topicState };
}

export async function completeTopic(studentId, topicId) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found.");
  if (topic.status !== "published") {
    throw new AppError(404, "NOT_FOUND", "Topic not found.");
  }

  const { states } = await loadStates(studentId, topic.subjectId);
  const topicState = states.find((s) => s.id === topicId);

  if (!topicState || !isTopicAccessible(topicState.state)) {
    if (topicState?.state === "scheduled") {
      throw new AppError(403, "TOPIC_NOT_AVAILABLE", "This topic is not available yet.");
    }
    throw new AppError(403, "TOPIC_LOCKED", topicState?.reason || "This topic is locked.");
  }

  await deps.topicsRepo.recordTopicProgress(studentId, topicId);
  return { completed: true };
}
