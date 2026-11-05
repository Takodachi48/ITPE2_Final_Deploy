import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../lib/errors.js';

import { setDeps } from '../services/student-topics.service.js';

const state = {
  topic: null,
  subject: null,
  enrollment: null,
  recorded: [],
  quiz: null,
  attempts: [],
};

const fakeTopicsRepo = {
  findTopicById: async (id) => (state.topic && state.topic.id === id ? state.topic : null),
  listTopicsBySubject: async () => (state.topic ? [state.topic] : []),
  recordTopicProgress: async (studentId, topicId) => {
    const key = `${studentId}:${topicId}`;
    if (!state.recorded.includes(key)) state.recorded.push(key);
    return { student_id: studentId, topic_id: topicId };
  },
};

const fakeSubjectsRepo = {
  findSubjectById: async (id) => (state.subject && state.subject.id === id ? state.subject : null),
  findEnrollment: async (subjectId, studentId) =>
    state.enrollment && state.enrollment.subjectId === subjectId && state.enrollment.studentId === studentId
      ? state.enrollment
      : null,
};

const fakeQuizzesRepo = {
  findQuizByTopic: async () => state.quiz,
};

const fakeProgressRepo = {
  listPublishedQuizzesBySubject: async () => ({}),
  listAttemptsByStudentSubject: async () => state.attempts,
  listProgressByStudentSubject: async () => new Set(state.recorded.map((k) => k.split(':')[1])),
};

setDeps({ topicsRepo: fakeTopicsRepo, subjectsRepo: fakeSubjectsRepo, progressRepo: fakeProgressRepo, quizzesRepo: fakeQuizzesRepo });

const { listStudentTopics, getStudentTopic, completeTopic } = await import('../services/student-topics.service.js');

function reset() {
  fakeTopicsRepo.listTopicsBySubject = async () => (state.topic ? [state.topic] : []);
  state.topic = null;
  state.subject = null;
  state.enrollment = null;
  state.recorded = [];
  state.quiz = null;
  state.attempts = [];
}

const SUBJECT_ID = 'subj-1';
const STUDENT_ID = 'student-1';
const TOPIC_ID = 'topic-1';

function makeSubject() {
  return { id: SUBJECT_ID, facultyId: 'faculty-1', status: 'active' };
}
function makeEnrollment(active = true) {
  return { subjectId: SUBJECT_ID, studentId: STUDENT_ID, status: active ? 'active' : 'removed' };
}
function makeTopic(overrides = {}) {
  return {
    id: TOPIC_ID,
    subjectId: SUBJECT_ID,
    position: 1,
    title: 'Topic 1',
    status: 'published',
    availableFrom: new Date(Date.now() - 86400000).toISOString(),
    ...overrides,
  };
}

test('listStudentTopics: throws NOT_ENROLLED when not enrolled', async () => {
  reset();
  state.subject = makeSubject();
  state.enrollment = null;
  await assert.rejects(
    () => listStudentTopics(STUDENT_ID, SUBJECT_ID),
    (err) => err instanceof AppError && err.code === 'NOT_ENROLLED' && err.status === 403,
  );
});
test('listStudentTopics: returns published topics with state for enrolled student', async () => {
  reset();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  fakeTopicsRepo.listTopicsBySubject = async () => [
    makeTopic({ id: 't1', position: 1, status: 'published', availableFrom: new Date(Date.now() - 86400000).toISOString() }),
    makeTopic({ id: 't2', position: 2, status: 'draft', availableFrom: new Date(Date.now() - 86400000).toISOString() }),
    makeTopic({ id: 't3', position: 3, status: 'published', availableFrom: new Date(Date.now() + 86400000).toISOString() }),
  ];
  const result = await listStudentTopics(STUDENT_ID, SUBJECT_ID);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 't1');
  assert.equal(result[0].state, 'open');
  assert.equal(result[1].id, 't3');
  assert.equal(result[1].state, 'scheduled');
  fakeTopicsRepo.listTopicsBySubject = async () => [];
});

test('getStudentTopic: throws NOT_FOUND for missing topic', async () => {
  reset();
  state.topic = null;
  await assert.rejects(
    () => getStudentTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'NOT_FOUND' && err.status === 404,
  );
});

test('getStudentTopic: throws NOT_FOUND for draft topic (never returned to students)', async () => {
  reset();
  state.topic = makeTopic({ status: 'draft' });
  state.subject = makeSubject();
  await assert.rejects(
    () => getStudentTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'NOT_FOUND' && err.status === 404,
  );
});

test('getStudentTopic: throws NOT_ENROLLED when not enrolled', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = null;
  await assert.rejects(
    () => getStudentTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'NOT_ENROLLED' && err.status === 403,
  );
});

test('getStudentTopic: throws TOPIC_NOT_AVAILABLE for future topic', async () => {
  reset();
  state.topic = makeTopic({ availableFrom: new Date(Date.now() + 86400000).toISOString() });
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  await assert.rejects(
    () => getStudentTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'TOPIC_NOT_AVAILABLE' && err.status === 403,
  );
});

test('getStudentTopic: returns topic when published and available', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  const result = await getStudentTopic(STUDENT_ID, TOPIC_ID);
  assert.equal(result.id, TOPIC_ID);
});

test('completeTopic: throws NOT_FOUND for missing topic', async () => {
  reset();
  state.topic = null;
  await assert.rejects(
    () => completeTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'NOT_FOUND' && err.status === 404,
  );
});

test('completeTopic: throws NOT_FOUND for draft topic', async () => {
  reset();
  state.topic = makeTopic({ status: 'draft' });
  await assert.rejects(
    () => completeTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'NOT_FOUND' && err.status === 404,
  );
});

test('completeTopic: throws NOT_ENROLLED when not enrolled', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = null;
  await assert.rejects(
    () => completeTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'NOT_ENROLLED' && err.status === 403,
  );
});

test('completeTopic: throws TOPIC_NOT_AVAILABLE for future topic', async () => {
  reset();
  state.topic = makeTopic({ availableFrom: new Date(Date.now() + 86400000).toISOString() });
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  await assert.rejects(
    () => completeTopic(STUDENT_ID, TOPIC_ID),
    (err) => err instanceof AppError && err.code === 'TOPIC_NOT_AVAILABLE' && err.status === 403,
  );
});

test('completeTopic: records progress and returns completed (idempotent)', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  const r1 = await completeTopic(STUDENT_ID, TOPIC_ID);
  assert.deepEqual(r1, { completed: true });
  const r2 = await completeTopic(STUDENT_ID, TOPIC_ID);
  assert.deepEqual(r2, { completed: true });
  assert.equal(state.recorded.length, 1);
});

test('getStudentTopic: returns attempts with passed flag when quiz exists', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = { ...makeSubject(), passingPercent: 75 };
  state.enrollment = makeEnrollment();
  state.quiz = {
    id: 'quiz-1',
    topicId: TOPIC_ID,
    title: 'Quiz 1',
    mode: 'uploaded',
    totalItems: 20,
    status: 'published',
  };
  state.attempts = [
    { quizId: 'quiz-1', studentId: STUDENT_ID, attemptNo: 2, source: 'manual', status: 'graded', score: 15, total: 20, feedback: 'Good work', submittedAt: new Date().toISOString() },
    { quizId: 'quiz-1', studentId: STUDENT_ID, attemptNo: 1, source: 'manual', status: 'pending_review', score: null, total: null, feedback: null, submittedAt: null },
  ];
  const result = await getStudentTopic(STUDENT_ID, TOPIC_ID);
  assert.ok(Array.isArray(result.attempts));
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0].attemptNo, 2);
  assert.equal(result.attempts[0].status, 'graded');
  assert.equal(result.attempts[0].passed, true);
  assert.equal(result.attempts[1].attemptNo, 1);
  assert.equal(result.attempts[1].status, 'pending_review');
  assert.equal(result.attempts[1].passed, null);
});

test('getStudentTopic: passed flag is false when graded attempt fails', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = { ...makeSubject(), passingPercent: 75 };
  state.enrollment = makeEnrollment();
  state.quiz = {
    id: 'quiz-1',
    topicId: TOPIC_ID,
    title: 'Quiz 1',
    mode: 'uploaded',
    totalItems: 20,
    status: 'published',
  };
  state.attempts = [
    { quizId: 'quiz-1', studentId: STUDENT_ID, attemptNo: 1, source: 'manual', status: 'graded', score: 10, total: 20, feedback: null, submittedAt: new Date().toISOString() },
  ];
  const result = await getStudentTopic(STUDENT_ID, TOPIC_ID);
  assert.equal(result.attempts[0].passed, false);
});

test('getStudentTopic: returns empty attempts when no quiz', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  state.quiz = null;
  state.attempts = [];
  const result = await getStudentTopic(STUDENT_ID, TOPIC_ID);
  assert.ok(Array.isArray(result.attempts));
  assert.equal(result.attempts.length, 0);
});

