// server/services/report.service.js
// Pure report generation and sorting (BR-01, BR-14, Spec 05).

import { isPassed, computePercent } from './grading.js';
import { AppError } from '../lib/errors.js';
import * as subjectsRepoModule from '../repositories/subjects.repository.js';
import * as topicsRepoModule from '../repositories/topics.repository.js';
import * as quizzesRepoModule from '../repositories/quizzes.repository.js';
import * as progressRepoModule from '../repositories/progress.repository.js';

export const deps = {
  subjectsRepo: subjectsRepoModule,
  topicsRepo: topicsRepoModule,
  quizzesRepo: quizzesRepoModule,
  progressRepo: progressRepoModule,
};

export function setDeps(overrides) {
  if (overrides.subjectsRepo) deps.subjectsRepo = overrides.subjectsRepo;
  if (overrides.topicsRepo) deps.topicsRepo = overrides.topicsRepo;
  if (overrides.quizzesRepo) deps.quizzesRepo = overrides.quizzesRepo;
  if (overrides.progressRepo) deps.progressRepo = overrides.progressRepo;
}

/**
 * Pure report builder function.
 *
 * @param {Object} opts
 * @param {Object} opts.subject        – { id, code, name, term, schoolYear, passingPercent, facultyName }
 * @param {Array}  opts.students       – enrolled students [{ id, firstName, lastName, studentNumber }]
 * @param {Array}  opts.topics         – published topics [{ id, position, title, availableFrom }]
 * @param {Object} opts.quizByTopicId  – map topicId -> published quiz { id, topicId, title, totalItems, mode }
 * @param {Array}  opts.attempts       – all attempts for the subject [{ studentId, quizId, status, score, total, source, submittedAt, startedAt }]
 * @param {number} opts.passingPercent – subject passing %
 * @param {string} opts.sort           – 'surname' | 'score' (default 'surname')
 * @param {string} opts.dir            – 'asc' | 'desc' (default 'asc')
 * @param {Date}   opts.now            – current server timestamp
 */
export function buildReport({
  subject,
  students = [],
  topics = [],
  quizByTopicId = {},
  attempts = [],
  passingPercent,
  sort = 'surname',
  dir = 'asc',
  now = new Date(),
}) {
  const passPct = passingPercent !== undefined ? passingPercent : (subject?.passingPercent ?? 75);

  // 1. Quizzes: published quizzes whose topics have opened (now >= available_from)
  // ordered by topic position
  const openedTopics = topics
    .filter((t) => t.status === 'published' && new Date(t.availableFrom) <= now)
    .sort((a, b) => a.position - b.position);

  const quizzesList = [];
  for (const t of openedTopics) {
    const q = quizByTopicId[t.id];
    if (q && q.status === 'published') {
      quizzesList.push({
        quizId: q.id,
        topicId: t.id,
        position: t.position,
        topicTitle: t.title,
        totalItems: q.totalItems || 0,
      });
    }
  }

  // 2. Index attempts: key `${studentId}:${quizId}` -> [attempts]
  const attemptsMap = {};
  for (const a of attempts) {
    const key = `${a.studentId}:${a.quizId}`;
    if (!attemptsMap[key]) attemptsMap[key] = [];
    attemptsMap[key].push(a);
  }

  // 3. Build each student row
  const rows = students.map((s) => {
    let sumPercents = 0;
    let passedCount = 0;
    let totalGradedQuizzes = 0;

    const scores = quizzesList.map((q) => {
      const studentQuizAttempts = attemptsMap[`${s.id}:${q.quizId}`] || [];
      const graded = studentQuizAttempts.filter(
        (a) => a.status === 'graded' && a.score !== null && a.total !== null,
      );

      if (graded.length === 0) {
        // Missing quiz counts as 0% in average, not passed
        return null;
      }

      totalGradedQuizzes += 1;

      // Find best: highest percent, ties latest
      let best = null;
      for (const a of graded) {
        const pct = a.total > 0 ? (Number(a.score) / Number(a.total)) * 100 : 0;
        if (!best) {
          best = { attempt: a, pct };
          continue;
        }
        if (
          pct > best.pct ||
          (pct === best.pct &&
            new Date(a.submittedAt || a.startedAt) >
              new Date(best.attempt.submittedAt || best.attempt.startedAt))
        ) {
          best = { attempt: a, pct };
        }
      }

      const scoreNum = Number(best.attempt.score);
      const totalNum = Number(best.attempt.total);
      const passed = isPassed(scoreNum, totalNum, passPct);
      const percent = computePercent(scoreNum, totalNum);

      if (passed) passedCount += 1;
      sumPercents += percent;

      return {
        quizId: q.quizId,
        score: scoreNum,
        total: totalNum,
        percent,
        passed,
        attempts: studentQuizAttempts.length,
        source: best.attempt.source,
      };
    });

    const quizCount = quizzesList.length;
    const average = quizCount > 0 ? Math.round((sumPercents / quizCount) * 100) / 100 : 0;

    let remark = 'No quizzes yet';
    if (quizCount > 0) {
      remark = average >= passPct ? 'Passed' : 'Failed';
    }

    return {
      studentId: s.id,
      lastName: s.lastName,
      firstName: s.firstName,
      studentNumber: s.studentNumber,
      scores,
      passedCount,
      quizCount,
      average,
      remark,
      hasAttempts: totalGradedQuizzes > 0,
    };
  });

  // 4. Sort rows
  // Locale-aware, accent-insensitive comparator
  const compareNames = (a, b) => {
    const last = (a.lastName || '').localeCompare(b.lastName || '', 'en', { sensitivity: 'base' });
    if (last !== 0) return last;
    return (a.firstName || '').localeCompare(b.firstName || '', 'en', { sensitivity: 'base' });
  };

  rows.sort((a, b) => {
    if (sort === 'score') {
      // Students with no quizzes last
      if (a.hasAttempts && !b.hasAttempts) return -1;
      if (!a.hasAttempts && b.hasAttempts) return 1;

      // Primary key: average
      const scoreDiff = dir === 'desc' ? b.average - a.average : a.average - b.average;
      if (scoreDiff !== 0) return scoreDiff;

      // Ties broken by surname A-Z
      return compareNames(a, b);
    }

    // Default: surname
    const nameDiff = compareNames(a, b);
    return dir === 'desc' ? -nameDiff : nameDiff;
  });

  // Clean helper property
  rows.forEach((r) => delete r.hasAttempts);

  // 5. Compute class summary
  const studentCount = rows.length;
  let totalAverageSum = 0;
  let totalPassedStudents = 0;

  for (const r of rows) {
    totalAverageSum += r.average;
    if (r.remark === 'Passed') totalPassedStudents += 1;
  }

  const classAverage =
    studentCount > 0 ? Math.round((totalAverageSum / studentCount) * 100) / 100 : 0;
  const passRate =
    studentCount > 0 ? Math.round((totalPassedStudents / studentCount) * 100 * 100) / 100 : 0;

  return {
    subject: {
      id: subject?.id,
      code: subject?.code,
      name: subject?.name,
      term: subject?.term,
      schoolYear: subject?.schoolYear,
      passingPercent: passPct,
      faculty: subject?.facultyName || '',
    },
    generatedAt: now.toISOString(),
    quizzes: quizzesList,
    rows,
    summary: {
      students: studentCount,
      classAverage,
      passRate,
    },
  };
}

/**
 * Service endpoint for GET /faculty/subjects/:id/report
 */
export async function getSubjectReport(facultyId, subjectId, { sort, dir }, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  const enrollments = await deps.subjectsRepo.listEnrollmentsBySubject(subjectId);
  const activeStudents = enrollments
    .filter((e) => e.status === 'active')
    .map((e) => e.student);

  const topics = await deps.topicsRepo.listTopicsBySubject(subjectId);
  const [quizByTopicId, attempts] = await Promise.all([
    deps.progressRepo.listPublishedQuizzesBySubject(subjectId),
    deps.progressRepo.listAllAttemptsBySubject(subjectId),
  ]);

  return buildReport({
    subject,
    students: activeStudents,
    topics,
    quizByTopicId,
    attempts,
    passingPercent: subject.passingPercent,
    sort,
    dir,
    now: new Date(),
  });
}

/**
 * Service endpoint for GET /faculty/subjects/:id/students/:studentId/scores (RPT-02)
 */
export async function getStudentScores(facultyId, subjectId, studentId, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  const enrollment = await deps.subjectsRepo.findEnrollment(subjectId, studentId);
  if (!enrollment) throw new AppError(404, 'NOT_FOUND', 'Student not found in this subject.');

  const topics = await deps.topicsRepo.listTopicsBySubject(subjectId);
  const quizByTopicId = await deps.progressRepo.listPublishedQuizzesBySubject(subjectId);
  const attempts = await deps.progressRepo.listAttemptsByStudentSubject(subjectId, studentId);

  const report = buildReport({
    subject,
    students: [enrollment.student || { id: studentId }],
    topics,
    quizByTopicId,
    attempts,
    passingPercent: subject.passingPercent,
    now: new Date(),
  });

  return {
    subject: report.subject,
    student: report.rows[0] || null,
    quizzes: report.quizzes,
  };
}

/**
 * Service endpoint for GET /student/subjects/:id/grades (RPT-03)
 */
export async function getStudentGrades(studentId, subjectId) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');

  const enrollment = await deps.subjectsRepo.findEnrollment(subjectId, studentId);
  if (!enrollment || enrollment.status !== 'active') {
    throw new AppError(403, 'NOT_ENROLLED', 'You are not enrolled in this subject.');
  }

  const topics = await deps.topicsRepo.listTopicsBySubject(subjectId);
  const quizByTopicId = await deps.progressRepo.listPublishedQuizzesBySubject(subjectId);
  const attempts = await deps.progressRepo.listAttemptsByStudentSubject(subjectId, studentId);

  const report = buildReport({
    subject,
    students: [{ id: studentId, firstName: '', lastName: '', studentNumber: '' }],
    topics,
    quizByTopicId,
    attempts,
    passingPercent: subject.passingPercent,
    now: new Date(),
  });

  const row = report.rows[0];
  return {
    subject: report.subject,
    quizzes: report.quizzes,
    student: {
      scores: row?.scores || [],
      passedCount: row?.passedCount || 0,
      quizCount: row?.quizCount || 0,
      average: row?.average || 0,
      remark: row?.remark || 'No quizzes yet',
    },
    passingPercent: subject.passingPercent,
  };
}

