// server/services/progress.service.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { computeTopicStates, isTopicAccessible, getFacultyProgress, setDeps } from './progress.service.js';

function topic(id, position, availableFrom, title = `Topic ${position}`) {
  return { id, position, title, availableFrom, subjectId: 'subj1', status: 'published' };
}

function quiz(id, topicId) {
  return { id, topicId, status: 'published' };
}

function attempt(quizId, { status = 'graded', score = null, total = null } = {}) {
  return { id: `att-${Math.random()}`, quizId, status, score, total, studentId: 's1' };
}

const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';
const NOW = new Date('2026-11-01T12:00:00Z');

describe('computeTopicStates', () => {
  // Scenario 1: All dates in the future → scheduled, scheduled, scheduled
  it('scenario 1: all future → all scheduled', () => {
    const topics = [topic('t1', 1, FUTURE), topic('t2', 2, FUTURE), topic('t3', 3, FUTURE)];
    const states = computeTopicStates({
      topics, quizByTopicId: {}, attempts: [], progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.deepStrictEqual(states.map((s) => s.state), ['scheduled', 'scheduled', 'scheduled']);
  });

  // Scenario 2: T1,T2 past, no attempts → open, locked, scheduled-or-locked
  it('scenario 2: T1,T2 past no attempts → open, locked, scheduled/locked', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST), topic('t3', 3, FUTURE)];
    const quizByTopicId = { t1: quiz('q1', 't1'), t2: quiz('q2', 't2'), t3: quiz('q3', 't3') };
    const states = computeTopicStates({
      topics, quizByTopicId, attempts: [], progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'open');
    assert.strictEqual(states[1].state, 'locked');
    // T3: scheduled wins over locked (BR-06 order 1 before order 2)
    assert.strictEqual(states[2].state, 'scheduled');
  });

  // Scenario 3: T1 attempt 7/10 (70%) → T1 failed, T2 locked
  it('scenario 3: T1 7/10 at 75% → failed, locked', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST)];
    const quizByTopicId = { t1: quiz('q1', 't1'), t2: quiz('q2', 't2') };
    const attempts = [attempt('q1', { score: 7, total: 10 })];
    const states = computeTopicStates({
      topics, quizByTopicId, attempts, progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'failed');
    assert.strictEqual(states[1].state, 'locked');
  });

  // Scenario 4: T1 attempt 8/10 → T1 completed, T2 open
  it('scenario 4: T1 8/10 → completed, open', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST)];
    const quizByTopicId = { t1: quiz('q1', 't1'), t2: quiz('q2', 't2') };
    const attempts = [attempt('q1', { score: 8, total: 10 })];
    const states = computeTopicStates({
      topics, quizByTopicId, attempts, progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'completed');
    assert.strictEqual(states[1].state, 'open');
  });

  // Scenario 5: T1 fails 7/10 then passes 8/10 → T1 completed
  it('scenario 5: T1 fail then pass → completed', () => {
    const topics = [topic('t1', 1, PAST)];
    const quizByTopicId = { t1: quiz('q1', 't1') };
    const attempts = [
      attempt('q1', { score: 7, total: 10 }),
      attempt('q1', { score: 8, total: 10 }),
    ];
    const states = computeTopicStates({
      topics, quizByTopicId, attempts, progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'completed');
  });

  // Scenario 6: T1 8/10, passing raised to 90 → T1 failed, T2 locked
  it('scenario 6: pass raised to 90 → failed, locked', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST)];
    const quizByTopicId = { t1: quiz('q1', 't1'), t2: quiz('q2', 't2') };
    const attempts = [attempt('q1', { score: 8, total: 10 })];
    const states = computeTopicStates({
      topics, quizByTopicId, attempts, progressTopicIds: new Set(), passingPercent: 90, now: NOW,
    });
    assert.strictEqual(states[0].state, 'failed');
    assert.strictEqual(states[1].state, 'locked');
  });

  // Scenario 7: T1 7/10, passing lowered to 50 → T1 completed, T2 open
  it('scenario 7: pass lowered to 50 → completed, open', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST)];
    const quizByTopicId = { t1: quiz('q1', 't1'), t2: quiz('q2', 't2') };
    const attempts = [attempt('q1', { score: 7, total: 10 })];
    const states = computeTopicStates({
      topics, quizByTopicId, attempts, progressTopicIds: new Set(), passingPercent: 50, now: NOW,
    });
    assert.strictEqual(states[0].state, 'completed');
    assert.strictEqual(states[1].state, 'open');
  });

  // Scenario 8: T1 uploaded-quiz attempt pending → T1 pending_review, T2 locked
  it('scenario 8: pending review → pending_review, locked', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST)];
    const quizByTopicId = { t1: quiz('q1', 't1'), t2: quiz('q2', 't2') };
    const attempts = [attempt('q1', { status: 'pending_review', score: null, total: null })];
    const states = computeTopicStates({
      topics, quizByTopicId, attempts, progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'pending_review');
    assert.strictEqual(states[1].state, 'locked');
  });

  // Scenario 9: T1 has no published quiz, not viewed → T1 open, T2 locked
  it('scenario 9: no quiz, not viewed → open, locked', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST)];
    const quizByTopicId = { t2: quiz('q2', 't2') };
    const states = computeTopicStates({
      topics, quizByTopicId, attempts: [], progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'open');
    assert.strictEqual(states[1].state, 'locked');
  });

  // Scenario 9b: no quiz but viewed → completed, next open
  it('scenario 9b: no quiz, viewed → completed, open', () => {
    const topics = [topic('t1', 1, PAST), topic('t2', 2, PAST)];
    const quizByTopicId = { t2: quiz('q2', 't2') };
    const states = computeTopicStates({
      topics, quizByTopicId, attempts: [], progressTopicIds: new Set(['t1']), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'completed');
    assert.strictEqual(states[1].state, 'open');
  });

  // Scenario 10: T2 is draft → T1 then T3, T2 skipped (only published topics passed in)
  it('scenario 10: draft topic excluded → sequence skips it', () => {
    // Only published topics are in the array; T2 draft is omitted by the caller
    const topics = [topic('t1', 1, PAST), topic('t3', 3, PAST)];
    const quizByTopicId = { t1: quiz('q1', 't1'), t3: quiz('q3', 't3') };
    const attempts = [attempt('q1', { score: 8, total: 10 })];
    const states = computeTopicStates({
      topics, quizByTopicId, attempts, progressTopicIds: new Set(), passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states[0].state, 'completed');
    assert.strictEqual(states[1].state, 'open'); // T3 follows T1 directly
  });

  // Scenario 11: 23:59 vs 00:00 Manila on T2's date
  it('scenario 11: timezone boundary', () => {
    // T2 opens 2026-11-02 at 00:00 Manila (UTC+8) = 2026-11-01T16:00:00Z
    const t2Date = '2026-11-02T00:00:00+08:00';
    const topics = [topic('t1', 1, PAST), topic('t2', 2, t2Date)];
    const quizByTopicId = { t1: quiz('q1', 't1') };

    // at 23:59 Manila on Nov 1 = 15:59 UTC on Nov 1 → T2 scheduled
    const nowBefore = new Date('2026-11-01T15:59:00Z');
    const states1 = computeTopicStates({
      topics, quizByTopicId, attempts: [attempt('q1', { score: 10, total: 10 })],
      progressTopicIds: new Set(), passingPercent: 75, now: nowBefore,
    });
    assert.strictEqual(states1[1].state, 'scheduled');

    // at 00:00 Manila on Nov 2 = 16:00 UTC on Nov 1 → T2 open
    const nowAfter = new Date('2026-11-01T16:00:00Z');
    const states2 = computeTopicStates({
      topics, quizByTopicId, attempts: [attempt('q1', { score: 10, total: 10 })],
      progressTopicIds: new Set(), passingPercent: 75, now: nowAfter,
    });
    assert.strictEqual(states2[1].state, 'open');
  });

  // Scenario 12: T1 quiz unpublished after student passed → no quiz in quizByTopicId
  // Complete only if topic_progress exists (BR-05)
  it('scenario 12: quiz unpublished after pass → complete if viewed', () => {
    const topics = [topic('t1', 1, PAST)];
    // No published quiz → uses topic_progress
    const states1 = computeTopicStates({
      topics, quizByTopicId: {}, attempts: [], progressTopicIds: new Set(['t1']),
      passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states1[0].state, 'completed');

    // Not viewed → open
    const states2 = computeTopicStates({
      topics, quizByTopicId: {}, attempts: [], progressTopicIds: new Set(),
      passingPercent: 75, now: NOW,
    });
    assert.strictEqual(states2[0].state, 'open');
  });
});

describe('isTopicAccessible', () => {
  it('allows open, failed, pending_review, completed', () => {
    assert.strictEqual(isTopicAccessible('open'), true);
    assert.strictEqual(isTopicAccessible('failed'), true);
    assert.strictEqual(isTopicAccessible('pending_review'), true);
    assert.strictEqual(isTopicAccessible('completed'), true);
  });

  it('rejects scheduled and locked', () => {
    assert.strictEqual(isTopicAccessible('scheduled'), false);
    assert.strictEqual(isTopicAccessible('locked'), false);
  });
});

describe('GATE-05: dynamic effects of setting changes (no stored state)', () => {
  const baseTopics = [
    { id: 't1', position: 1, title: 'Topic 1', availableFrom: PAST, subjectId: 'subj1', status: 'published' },
    { id: 't2', position: 2, title: 'Topic 2', availableFrom: PAST, subjectId: 'subj1', status: 'published' },
  ];
  const baseQuizByTopicId = { t1: { id: 'q1', topicId: 't1', status: 'published' } };
  const baseNow = NOW;

  it('raising passing percent flips completed → failed, and next topic open → locked', () => {
    const attempts = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 8, total: 10, studentId: 's1' }];

    const at75 = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(at75[0].state, 'completed');
    assert.strictEqual(at75[1].state, 'open');

    const at90 = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 90, now: baseNow,
    });
    assert.strictEqual(at90[0].state, 'failed');
    assert.strictEqual(at90[1].state, 'locked');
  });

  it('lowering passing percent flips failed → completed, and next topic locked → open', () => {
    const attempts = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 7, total: 10, studentId: 's1' }];

    const at90 = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 90, now: baseNow,
    });
    assert.strictEqual(at90[0].state, 'failed');
    assert.strictEqual(at90[1].state, 'locked');

    const at50 = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 50, now: baseNow,
    });
    assert.strictEqual(at50[0].state, 'completed');
    assert.strictEqual(at50[1].state, 'open');
  });

  it('unpublishing a quiz flips completed → open (topic_progress path)', () => {
    const attempts = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 10, total: 10, studentId: 's1' }];

    const withQuiz = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(withQuiz[0].state, 'completed');

    const withoutQuiz = computeTopicStates({
      topics: baseTopics, quizByTopicId: {}, attempts,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(withoutQuiz[0].state, 'open');
    assert.strictEqual(withoutQuiz[1].state, 'locked');
  });

  it('publishing a quiz flips open → completed when a passing attempt exists', () => {
    const attempts = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 10, total: 10, studentId: 's1' }];

    const withoutQuiz = computeTopicStates({
      topics: baseTopics, quizByTopicId: {}, attempts,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(withoutQuiz[0].state, 'open');

    const withQuiz = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(withQuiz[0].state, 'completed');
    assert.strictEqual(withQuiz[1].state, 'open');
  });

  it('regrading a lower score flips completed → failed', () => {
    const attemptsHigh = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 10, total: 10, studentId: 's1' }];
    const completed = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts: attemptsHigh,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(completed[0].state, 'completed');

    const attemptsLow = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 7, total: 10, studentId: 's1' }];
    const failed = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts: attemptsLow,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(failed[0].state, 'failed');
    assert.strictEqual(failed[1].state, 'locked');
  });

  it('regrading a manual attempt from pending_review to graded flips pending_review → completed/failed', () => {
    const pending = [{ id: 'a1', quizId: 'q1', status: 'pending_review', score: null, total: null, studentId: 's1' }];
    const pendingState = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts: pending,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(pendingState[0].state, 'pending_review');
    assert.strictEqual(pendingState[1].state, 'locked');

    const gradedPass = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 10, total: 10, studentId: 's1' }];
    const passState = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts: gradedPass,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(passState[0].state, 'completed');
    assert.strictEqual(passState[1].state, 'open');

    const gradedFail = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 7, total: 10, studentId: 's1' }];
    const failState = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts: gradedFail,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.strictEqual(failState[0].state, 'failed');
    assert.strictEqual(failState[1].state, 'locked');
  });

  it('no stored state to fix: same inputs always produce same outputs', () => {
    const attempts = [{ id: 'a1', quizId: 'q1', status: 'graded', score: 8, total: 10, studentId: 's1' }];
    const first = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    const second = computeTopicStates({
      topics: baseTopics, quizByTopicId: baseQuizByTopicId, attempts,
      progressTopicIds: new Set(), passingPercent: 75, now: baseNow,
    });
    assert.deepStrictEqual(first, second);
  });
});

describe('GATE-06: getFacultyProgress', () => {
  const FACULTY_ID = 'faculty-1';
  const OTHER_FACULTY_ID = 'faculty-2';
  const SUBJECT_ID = 'subj-1';
  const STUDENT_1 = 'student-1';
  const STUDENT_2 = 'student-2';
  const TOPIC_1 = 'topic-1';
  const TOPIC_2 = 'topic-2';
  const QUIZ_1 = 'quiz-1';

  const fakeSubjectsRepo = {
    findSubjectById: async (id) => (id === SUBJECT_ID
      ? { id: SUBJECT_ID, facultyId: FACULTY_ID, passingPercent: 75, status: 'active' }
      : null),
    listEnrollmentsBySubject: async () => [
      {
        studentId: STUDENT_1,
        student: { id: STUDENT_1, firstName: 'Alice', lastName: 'Lee', studentNumber: 'S001', email: 'alice@example.com' },
      },
      {
        studentId: STUDENT_2,
        student: { id: STUDENT_2, firstName: 'Bob', lastName: 'Tan', studentNumber: 'S002', email: 'bob@example.com' },
      },
    ],
  };

  const fakeTopicsRepo = {
    listTopicsBySubject: async () => [
      { id: TOPIC_1, position: 1, title: 'Topic 1', availableFrom: '2020-01-01T00:00:00Z', subjectId: SUBJECT_ID, status: 'published' },
      { id: TOPIC_2, position: 2, title: 'Topic 2', availableFrom: '2020-01-01T00:00:00Z', subjectId: SUBJECT_ID, status: 'published' },
    ],
  };

  const fakeProgressRepo = {
    listPublishedQuizzesBySubject: async () => ({ [TOPIC_1]: { id: QUIZ_1, topicId: TOPIC_1, status: 'published' } }),
    listAllAttemptsBySubject: async () => [
      { id: 'a1', quizId: QUIZ_1, studentId: STUDENT_1, attemptNo: 1, status: 'graded', score: 8, total: 10 },
      { id: 'a2', quizId: QUIZ_1, studentId: STUDENT_2, attemptNo: 1, status: 'graded', score: 5, total: 10 },
    ],
    listAllProgressBySubject: async () => new Map([
      [STUDENT_1, new Set([TOPIC_1])],
    ]),
  };

  beforeEach(() => {
    setDeps({ subjectsRepo: fakeSubjectsRepo, topicsRepo: fakeTopicsRepo, progressRepo: fakeProgressRepo });
  });

  it('throws NOT_FOUND for missing subject', async () => {
    await assert.rejects(
      () => getFacultyProgress(FACULTY_ID, 'no-such-subject', false),
      (err) => err.status === 404 && err.code === 'NOT_FOUND',
    );
  });

  it('throws NOT_FOUND for non-owner faculty', async () => {
    await assert.rejects(
      () => getFacultyProgress(OTHER_FACULTY_ID, SUBJECT_ID, false),
      (err) => err.status === 404 && err.code === 'NOT_FOUND',
    );
  });

  it('returns each student with topic states', async () => {
    const result = await getFacultyProgress(FACULTY_ID, SUBJECT_ID, false);
    assert.ok(result.subject);
    assert.equal(result.subject.id, SUBJECT_ID);
    assert.equal(result.students.length, 2);

    const alice = result.students.find((s) => s.studentId === STUDENT_1);
    const bob = result.students.find((s) => s.studentId === STUDENT_2);

    assert.ok(alice);
    assert.equal(alice.student.firstName, 'Alice');
    assert.equal(alice.topics.length, 2);
    assert.equal(alice.topics[0].id, TOPIC_1);
    assert.equal(alice.topics[0].state, 'completed'); // 8/10 at 75% = pass
    assert.equal(alice.topics[1].state, 'open'); // T2 follows T1

    assert.ok(bob);
    assert.equal(bob.student.firstName, 'Bob');
    assert.equal(bob.topics[0].state, 'failed'); // 5/10 at 75% = fail
    assert.equal(bob.topics[1].state, 'locked'); // T2 locked because T1 failed
  });

  it('admin can access any subject', async () => {
    const result = await getFacultyProgress(OTHER_FACULTY_ID, SUBJECT_ID, true);
    assert.equal(result.students.length, 2);
  });
});

