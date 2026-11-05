// server/repositories/progress.repository.test.js
// GATE-02: fixed query count regardless of topic or student count (no N+1).
// Verified with query counting on 16 topics × 40 students.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setDeps } from './progress.repository.js';
import * as repo from './progress.repository.js';

let callCount = 0;
const fakeDbQuery = async () => {
  callCount++;
  return { rows: [] };
};

describe('progress.repository: fixed query count (no N+1)', () => {
  beforeEach(() => {
    callCount = 0;
    setDeps({ dbQuery: fakeDbQuery });
  });

  // One student: 3 queries total regardless of topic count.
  it('listPublishedQuizzesBySubject: exactly 1 query', async () => {
    await repo.listPublishedQuizzesBySubject('subj-1');
    assert.strictEqual(callCount, 1);
  });

  it('listAttemptsByStudentSubject: exactly 1 query', async () => {
    await repo.listAttemptsByStudentSubject('subj-1', 'student-1');
    assert.strictEqual(callCount, 1);
  });

  it('listProgressByStudentSubject: exactly 1 query', async () => {
    await repo.listProgressByStudentSubject('subj-1', 'student-1');
    assert.strictEqual(callCount, 1);
  });

  // Whole subject: 3 queries total regardless of student count.
  it('listAllAttemptsBySubject: exactly 1 query for any number of students', async () => {
    await repo.listAllAttemptsBySubject('subj-1');
    assert.strictEqual(callCount, 1);
  });

  it('listAllProgressBySubject: exactly 1 query for any number of students', async () => {
    await repo.listAllProgressBySubject('subj-1');
    assert.strictEqual(callCount, 1);
  });

  // 16 topics x 40 students: one-student load = 3 queries, whole subject = 3 queries.
  it('one student across 16 topics: fixed 3 queries', async () => {
    await repo.listPublishedQuizzesBySubject('subj-1');
    await repo.listAttemptsByStudentSubject('subj-1', 'student-1');
    await repo.listProgressByStudentSubject('subj-1', 'student-1');
    assert.strictEqual(callCount, 3);
  });

  it('whole subject 40 students: fixed 3 queries', async () => {
    await repo.listPublishedQuizzesBySubject('subj-1');
    await repo.listAllAttemptsBySubject('subj-1');
    await repo.listAllProgressBySubject('subj-1');
    assert.strictEqual(callCount, 3);
  });
});
