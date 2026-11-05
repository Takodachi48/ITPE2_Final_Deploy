// server/services/progress.service.js
// Pure functions for computing topic states (BR-03 to BR-06).
// No database or clock reads – everything is passed as arguments.

import { isPassed } from './grading.js';
import { AppError } from '../lib/errors.js';
import * as subjectsRepoModule from '../repositories/subjects.repository.js';
import * as topicsRepoModule from '../repositories/topics.repository.js';
import * as progressRepoModule from '../repositories/progress.repository.js';

export const deps = {
  subjectsRepo: subjectsRepoModule,
  topicsRepo: topicsRepoModule,
  progressRepo: progressRepoModule,
};

export function setDeps(overrides) {
  if (overrides.subjectsRepo) deps.subjectsRepo = overrides.subjectsRepo;
  if (overrides.topicsRepo) deps.topicsRepo = overrides.topicsRepo;
  if (overrides.progressRepo) deps.progressRepo = overrides.progressRepo;
}

/**
 * Compute the state of every published topic for one student.
 *
 * @param {Object} opts
 * @param {Array}  opts.topics        – published topics ordered by position (camelCase)
 * @param {Object} opts.quizByTopicId – map topicId → quiz (only published quizzes)
 * @param {Array}  opts.attempts      – all graded/pending/in_progress attempts for this student
 * @param {Set}    opts.progressTopicIds – set of topicIds where topic_progress exists
 * @param {number} opts.passingPercent
 * @param {Date}   opts.now
 * @returns {Array} topics with added `state`, `reason`, `blockedByTopicId`
 */
export function computeTopicStates({
  topics,
  quizByTopicId,
  attempts,
  progressTopicIds,
  passingPercent,
  now,
}) {
  // Build attempts index: quizId → [attempt]
  const attemptsByQuiz = {};
  for (const a of attempts) {
    if (!attemptsByQuiz[a.quizId]) attemptsByQuiz[a.quizId] = [];
    attemptsByQuiz[a.quizId].push(a);
  }

  function isTopicComplete(topic) {
    const quiz = quizByTopicId[topic.id];
    if (!quiz) {
      // No published quiz → complete if topic_progress exists
      return progressTopicIds.has(topic.id);
    }
    // Has published quiz → at least one graded attempt that passes
    const quizAttempts = attemptsByQuiz[quiz.id] || [];
    for (const a of quizAttempts) {
      if (a.status === 'graded' && a.score !== null && a.total !== null) {
        if (isPassed(a.score, a.total, passingPercent)) return true;
      }
    }
    return false;
  }

  function hasPendingReview(topic) {
    const quiz = quizByTopicId[topic.id];
    if (!quiz) return false;
    const quizAttempts = attemptsByQuiz[quiz.id] || [];
    return quizAttempts.some((a) => a.status === 'pending_review');
  }

  function hasGradedButNotPassed(topic) {
    const quiz = quizByTopicId[topic.id];
    if (!quiz) return false;
    const quizAttempts = attemptsByQuiz[quiz.id] || [];
    return quizAttempts.some((a) => a.status === 'graded');
  }

  const results = [];

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const availableFrom = new Date(topic.availableFrom);
    const startOfDay = new Date(availableFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(availableFrom);
    endOfDay.setHours(23, 59, 59, 999);

    // Order 1: scheduled
    if (now < startOfDay) {
      results.push({
        ...topic,
        state: 'scheduled',
        reason: 'Topic has not opened yet.',
        blockedByTopicId: null,
      });
      continue;
    }

    // Order 2: locked (previous published topic not complete)
    if (i > 0) {
      const prev = topics[i - 1];
      if (!isTopicComplete(prev)) {
        results.push({
          ...topic,
          state: 'locked',
          reason: `Pass "${prev.title}" first.`,
          blockedByTopicId: prev.id,
        });
        continue;
      }
    }

    // Order 3: completed
    if (isTopicComplete(topic)) {
      results.push({
        ...topic,
        state: 'completed',
        reason: null,
        blockedByTopicId: null,
      });
      continue;
    }

    // Order 4: pending_review
    if (hasPendingReview(topic)) {
      results.push({
        ...topic,
        state: 'pending_review',
        reason: 'Waiting for your instructor to grade.',
        blockedByTopicId: null,
      });
      continue;
    }

    // Order 5: failed (has graded attempts but none pass)
    if (hasGradedButNotPassed(topic)) {
      results.push({
        ...topic,
        state: 'failed',
        reason: 'Repeat this topic.',
        blockedByTopicId: null,
      });
      continue;
    }

    // Order 6: open
    results.push({
      ...topic,
      state: 'open',
      reason: null,
      blockedByTopicId: null,
    });
  }

  return results;
}

/**
 * Check whether a single topic is accessible for a student action
 * (content read, quiz start, upload, etc.).
 * Accessible states: open, failed, pending_review, completed.
 */
export function isTopicAccessible(state) {
  return ['open', 'failed', 'pending_review', 'completed'].includes(state);
}

/**
 * GATE-06: Faculty progress endpoint data.
 * Returns each enrolled student's topic state for a subject.
 * Uses bulk-loading repository calls (3 queries regardless of student/topic count).
 */
export async function getFacultyProgress(facultyId, subjectId, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  if (!subject) throw new AppError(404, "NOT_FOUND", "Subject not found.");
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, "NOT_FOUND", "Subject not found.");
  }

  const enrollments = await deps.subjectsRepo.listEnrollmentsBySubject(subjectId);
  const topics = await deps.topicsRepo.listTopicsBySubject(subjectId);
  const published = topics.filter((t) => t.status === "published");

  const [quizByTopicId, allAttempts, allProgress] = await Promise.all([
    deps.progressRepo.listPublishedQuizzesBySubject(subjectId),
    deps.progressRepo.listAllAttemptsBySubject(subjectId),
    deps.progressRepo.listAllProgressBySubject(subjectId),
  ]);

  const now = new Date();
  const students = [];

  for (const enrollment of enrollments) {
    const studentId = enrollment.studentId;
    const studentProgress = allProgress.get(studentId) || new Set();
    const studentAttempts = allAttempts.filter((a) => a.studentId === studentId);

    const states = computeTopicStates({
      topics: published,
      quizByTopicId,
      attempts: studentAttempts,
      progressTopicIds: studentProgress,
      passingPercent: subject.passingPercent,
      now,
    });

    students.push({
      studentId,
      student: enrollment.student,
      topics: states,
    });
  }

  return { subject, students };
}

