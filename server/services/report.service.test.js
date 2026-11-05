// server/services/report.service.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from './report.service.js';

describe('buildReport', () => {
  const subject = {
    id: 's1',
    code: 'IT101',
    name: 'Introduction to IT',
    term: '1st Semester',
    schoolYear: '2026-2027',
    passingPercent: 75,
    facultyName: 'Santos, Maria',
  };

  const topics = [
    { id: 't1', position: 1, title: 'Topic 1', status: 'published', availableFrom: '2026-01-01T00:00:00Z' },
    { id: 't2', position: 2, title: 'Topic 2', status: 'published', availableFrom: '2026-01-02T00:00:00Z' },
    { id: 't3', position: 3, title: 'Topic 3 (Future)', status: 'published', availableFrom: '2099-01-01T00:00:00Z' },
  ];

  const quizByTopicId = {
    t1: { id: 'q1', topicId: 't1', title: 'Quiz 1', totalItems: 10, status: 'published' },
    t2: { id: 'q2', topicId: 't2', title: 'Quiz 2', totalItems: 20, status: 'published' },
    t3: { id: 'q3', topicId: 't3', title: 'Quiz 3', totalItems: 10, status: 'published' },
  };

  const students = [
    { id: 'u1', firstName: 'Juan', lastName: 'Dela Cruz', studentNumber: '2026-001' },
    { id: 'u2', firstName: 'Maria', lastName: 'Aquino', studentNumber: '2026-002' },
    { id: 'u3', firstName: 'Pedro', lastName: 'Nuñez', studentNumber: '2026-003' },
    { id: 'u4', firstName: 'Ana', lastName: 'Nunez', studentNumber: '2026-004' },
    { id: 'u5', firstName: 'Mark', lastName: 'Alvarez-Cruz', studentNumber: '2026-005' },
    { id: 'u6', firstName: 'NoQuiz', lastName: 'Zero', studentNumber: '2026-006' },
  ];

  const attempts = [
    // Aquino (u2): 8/10 on q1, 16/20 on q2 -> 80% & 80% -> avg 80
    { studentId: 'u2', quizId: 'q1', status: 'graded', score: 8, total: 10, source: 'auto', submittedAt: '2026-02-01' },
    { studentId: 'u2', quizId: 'q2', status: 'graded', score: 16, total: 20, source: 'manual', submittedAt: '2026-02-02' },

    // Dela Cruz (u1): 10/10 on q1, missing q2 -> 100% & 0% -> avg 50
    { studentId: 'u1', quizId: 'q1', status: 'graded', score: 10, total: 10, source: 'auto', submittedAt: '2026-02-01' },

    // Nuñez (u3): 9/10 on q1, 18/20 on q2 -> 90% & 90% -> avg 90
    { studentId: 'u3', quizId: 'q1', status: 'graded', score: 9, total: 10, source: 'auto', submittedAt: '2026-02-01' },
    { studentId: 'u3', quizId: 'q2', status: 'graded', score: 18, total: 20, source: 'manual', submittedAt: '2026-02-02' },

    // Nunez (u4): 9/10 on q1, 18/20 on q2 -> 90% & 90% -> avg 90
    { studentId: 'u4', quizId: 'q1', status: 'graded', score: 9, total: 10, source: 'auto', submittedAt: '2026-02-01' },
    { studentId: 'u4', quizId: 'q2', status: 'graded', score: 18, total: 20, source: 'manual', submittedAt: '2026-02-02' },

    // Alvarez-Cruz (u5): 7/10 on q1 -> 70% & missing q2 (0%) -> avg 35
    { studentId: 'u5', quizId: 'q1', status: 'graded', score: 7, total: 10, source: 'auto', submittedAt: '2026-02-01' },
  ];

  it('excludes future topics and unpublished quizzes', () => {
    const report = buildReport({
      subject, students, topics, quizByTopicId, attempts, passingPercent: 75,
      now: new Date('2026-05-01'),
    });
    // q1 and q2 opened, q3 is in 2099 so excluded
    assert.equal(report.quizzes.length, 2);
    assert.deepEqual(report.quizzes.map((q) => q.quizId), ['q1', 'q2']);
  });

  it('sorts by surname asc including ñ and hyphenated names', () => {
    const report = buildReport({
      subject, students, topics, quizByTopicId, attempts, passingPercent: 75,
      sort: 'surname', dir: 'asc', now: new Date('2026-05-01'),
    });
    const lastNames = report.rows.map((r) => r.lastName);
    // Alvarez-Cruz, Aquino, Dela Cruz, Nunez / Nuñez (sort together in base sensitivity), Zero
    assert.equal(lastNames[0], 'Alvarez-Cruz');
    assert.equal(lastNames[1], 'Aquino');
    assert.equal(lastNames[2], 'Dela Cruz');
    assert.equal(lastNames[5], 'Zero');
  });

  it('sorts by surname desc when dir is desc', () => {
    const report = buildReport({
      subject, students, topics, quizByTopicId, attempts, passingPercent: 75,
      sort: 'surname', dir: 'desc', now: new Date('2026-05-01'),
    });
    assert.equal(report.rows[0].lastName, 'Zero');
    assert.equal(report.rows[report.rows.length - 1].lastName, 'Alvarez-Cruz');
  });

  it('sorts by score desc with missing quizzes counted as 0 and no-quiz students last', () => {
    const report = buildReport({
      subject, students, topics, quizByTopicId, attempts, passingPercent: 75,
      sort: 'score', dir: 'desc', now: new Date('2026-05-01'),
    });
    // u3 & u4 have 90%, u2 has 80%, u1 has 50% (100+0 / 2), u5 has 35% (70+0 / 2), u6 has no quizzes (0%)
    assert.equal(report.rows[0].average, 90);
    assert.equal(report.rows[1].average, 90);
    assert.equal(report.rows[2].average, 80);
    assert.equal(report.rows[3].average, 50);
    assert.equal(report.rows[4].average, 35);
    assert.equal(report.rows[5].lastName, 'Zero'); // students with no quizzes last
  });

  it('breaks score ties by surname', () => {
    const report = buildReport({
      subject, students, topics, quizByTopicId, attempts, passingPercent: 75,
      sort: 'score', dir: 'desc', now: new Date('2026-05-01'),
    });
    // u4 is Ana Nunez, u3 is Pedro Nuñez
    assert.equal(report.rows[0].firstName, 'Ana');
    assert.equal(report.rows[1].firstName, 'Pedro');
  });

  it('recomputes remarks and pass rate when passingPercent changes', () => {
    const report75 = buildReport({
      subject, students, topics, quizByTopicId, attempts, passingPercent: 75,
      now: new Date('2026-05-01'),
    });
    // 90 (Pass), 90 (Pass), 80 (Pass), 50 (Fail), 35 (Fail), 0 (Fail) -> 3/6 = 50%
    assert.equal(report75.summary.passRate, 50);

    const report50 = buildReport({
      subject, students, topics, quizByTopicId, attempts, passingPercent: 50,
      now: new Date('2026-05-01'),
    });
    // 90 (Pass), 90 (Pass), 80 (Pass), 50 (Pass), 35 (Fail), 0 (Fail) -> 4/6 = 66.67%
    assert.equal(report50.summary.passRate, 66.67);
  });
});

