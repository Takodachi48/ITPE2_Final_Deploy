// server/repositories/progress.repository.js
// Queries for loading gating data in bulk (no N+1).
import { dbQuery } from '../db/pool.js';
import { mapQuiz, mapAttempt } from '../utils/mappers.js';

export const deps = {
  dbQuery,
};

export function setDeps(overrides) {
  if (overrides.dbQuery) deps.dbQuery = overrides.dbQuery;
}

/**
 * Load all published quizzes for a subject, keyed by topic_id.
 */
export async function listPublishedQuizzesBySubject(subjectId) {
  const { rows } = await deps.dbQuery(
    `select q.id, q.topic_id, q.title, q.mode, q.instructions, q.total_items,
            q.external_url, q.attachment_path, q.attachment_name, q.attachment_mime,
            q.max_attempts, q.show_answers, q.status, q.created_at, q.updated_at
       from public.quizzes q
       join public.topics t on t.id = q.topic_id
      where t.subject_id = $1 and q.status = 'published'`,
    [subjectId],
  );
  const map = {};
  for (const row of rows) {
    map[row.topic_id] = mapQuiz(row);
  }
  return map;
}

/**
 * Load all attempts for a student in a subject.
 */
export async function listAttemptsByStudentSubject(subjectId, studentId) {
  const { rows } = await deps.dbQuery(
    `select a.id, a.quiz_id, a.student_id, a.attempt_no, a.source, a.status,
            a.answers, a.score, a.total, a.image_path, a.feedback, a.graded_by,
            a.graded_at, a.started_at, a.submitted_at, a.created_at, a.updated_at
       from public.attempts a
       join public.quizzes q on q.id = a.quiz_id
       join public.topics t on t.id = q.topic_id
      where t.subject_id = $1 and a.student_id = $2`,
    [subjectId, studentId],
  );
  return rows.map(mapAttempt);
}

/**
 * Load topic_progress rows for a student in a subject.
 * Returns a Set of topic ids.
 */
export async function listProgressByStudentSubject(subjectId, studentId) {
  const { rows } = await deps.dbQuery(
    `select tp.topic_id
       from public.topic_progress tp
       join public.topics t on t.id = tp.topic_id
      where t.subject_id = $1 and tp.student_id = $2`,
    [subjectId, studentId],
  );
  return new Set(rows.map((r) => r.topic_id));
}

/**
 * Load all attempts for ALL students in a subject (for faculty progress view).
 */
export async function listAllAttemptsBySubject(subjectId) {
  const { rows } = await deps.dbQuery(
    `select a.id, a.quiz_id, a.student_id, a.attempt_no, a.source, a.status,
            a.answers, a.score, a.total, a.image_path, a.feedback, a.graded_by,
            a.graded_at, a.started_at, a.submitted_at, a.created_at, a.updated_at
       from public.attempts a
       join public.quizzes q on q.id = a.quiz_id
       join public.topics t on t.id = q.topic_id
      where t.subject_id = $1`,
    [subjectId],
  );
  return rows.map(mapAttempt);
}

/**
 * Load all topic_progress rows for a subject (for faculty progress view).
 * Returns Map<studentId, Set<topicId>>.
 */
export async function listAllProgressBySubject(subjectId) {
  const { rows } = await deps.dbQuery(
    `select tp.student_id, tp.topic_id
       from public.topic_progress tp
       join public.topics t on t.id = tp.topic_id
      where t.subject_id = $1`,
    [subjectId],
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.student_id)) map.set(r.student_id, new Set());
    map.get(r.student_id).add(r.topic_id);
  }
  return map;
}

