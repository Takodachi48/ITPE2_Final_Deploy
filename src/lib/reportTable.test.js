// src/lib/reportTable.test.js
// RPT-05: pure toTable helpers, tested with node --test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePercent,
  isPassed,
  recomputePassFail,
  toTable,
} from './reportTable.js';

const BASE_REPORT = {
  subject: { id: 's1', code: 'IT101', name: 'Intro to Tech', passingPercent: 75 },
  generatedAt: '2026-11-03T09:00:00.000Z',
  quizzes: [
    { quizId: 'q1', topicId: 't1', position: 1, topicTitle: 'Topic 1', totalItems: 10 },
    { quizId: 'q2', topicId: 't2', position: 2, topicTitle: 'Topic 2', totalItems: 20 },
  ],
  rows: [
    {
      studentId: 'st1',
      lastName: 'Acosta',
      firstName: 'Girone',
      studentNumber: 'TUPT-23-0001',
      scores: [
        { quizId: 'q1', score: 8, total: 10, percent: 80, passed: true, attempts: 1, source: 'auto' },
        { quizId: 'q2', score: 15, total: 20, percent: 75, passed: true, attempts: 1, source: 'auto' },
      ],
      passedCount: 2,
      quizCount: 2,
      average: 77.5,
      remark: 'Passed',
    },
    {
      studentId: 'st2',
      lastName: 'Zulu',
      firstName: 'Maria',
      studentNumber: 'TUPT-23-0002',
      scores: [
        { quizId: 'q1', score: 5, total: 10, percent: 50, passed: false, attempts: 1, source: 'manual' },
        null,
      ],
      passedCount: 0,
      quizCount: 2,
      average: 25,
      remark: 'Failed',
    },
    {
      studentId: 'st3',
      lastName: 'Ñoñez',
      firstName: 'Ana',
      studentNumber: 'TUPT-23-0003',
      scores: [],
      passedCount: 0,
      quizCount: 2,
      average: 0,
      remark: 'No quizzes yet',
    },
  ],
  summary: { students: 3, classAverage: 34.17, passRate: 66.67 },
};

describe('computePercent', () => {
  it('returns percent rounded to hundredths', () => {
    assert.strictEqual(computePercent(8, 10), 80);
    assert.strictEqual(computePercent(15, 20), 75);
    assert.strictEqual(computePercent(7, 10), 70);
    assert.strictEqual(computePercent(1, 3), 33.33);
  });

  it('returns 0 for invalid or zero total', () => {
    assert.strictEqual(computePercent(null, 10), 0);
    assert.strictEqual(computePercent(8, 0), 0);
    assert.strictEqual(computePercent(undefined, undefined), 0);
  });
});

describe('isPassed', () => {
  it('passes when score meets passing percent', () => {
    assert.strictEqual(isPassed(8, 10, 75), true);   // 80% >= 75%
    assert.strictEqual(isPassed(15, 20, 75), true);  // 75% >= 75%
    assert.strictEqual(isPassed(75, 100, 75), true); // exactly 75%
  });

  it('fails when below passing percent', () => {
    assert.strictEqual(isPassed(7, 10, 75), false);   // 70% < 75%
    assert.strictEqual(isPassed(5, 10, 75), false);   // 50% < 75%
    assert.strictEqual(isPassed(74, 100, 75), false); // 74% < 75%
  });

  it('handles zero total', () => {
    assert.strictEqual(isPassed(0, 0, 75), false);
  });
});

describe('recomputePassFail', () => {
  it('returns passed and percent', () => {
    const result = recomputePassFail(8, 10, 75);
    assert.deepStrictEqual(result, { passed: true, percent: 80 });
  });

  it('recomputes fail at higher passing percent', () => {
    const result = recomputePassFail(8, 10, 90); // 80% < 90%
    assert.deepStrictEqual(result, { passed: false, percent: 80 });
  });
});

describe('toTable', () => {
  it('builds columns and rows from a report', () => {
    const result = toTable(BASE_REPORT);

    assert.equal(result.columns.length, 9);
    assert.equal(result.columns[0].key, 'num');
    assert.equal(result.columns[0].label, '#');
    assert.equal(result.columns[4].key, 'quiz-q1');
    assert.equal(result.columns[4].label, 'Topic 1');
    assert.equal(result.columns[5].key, 'quiz-q2');
    assert.equal(result.columns[5].label, 'Topic 2');
    assert.equal(result.columns[6].key, 'average');
    assert.equal(result.columns[7].key, 'passedCount');
    assert.equal(result.columns[8].key, 'remark');

    assert.equal(result.rows.length, 3);

    // First row: Acosta
    const r1 = result.rows[0];
    assert.equal(r1.cells.num.value, 1);
    assert.equal(r1.cells.studentNumber.value, 'TUPT-23-0001');
    assert.equal(r1.cells.lastName.value, 'Acosta');
    assert.equal(r1.cells['quiz-q1'].value, '8/10 · 80%');
    assert.equal(r1.cells['quiz-q1'].passed, true);
    assert.equal(r1.cells['quiz-q1'].failed, false);
    assert.equal(r1.cells['quiz-q2'].value, '15/20 · 75%');
    assert.equal(r1.cells.average.value, 77.5);
    assert.equal(r1.cells.passedCount.value, '2/2');
    assert.equal(r1.cells.remark.value, 'Passed');

    // Second row: Zulu with missing quiz q2
    const r2 = result.rows[1];
    assert.equal(r2.cells['quiz-q2'].value, '—');
    assert.equal(r2.cells['quiz-q2'].missing, true);
    assert.equal(r2.cells['quiz-q1'].value, '5/10 · 50%');
    assert.equal(r2.cells['quiz-q1'].failed, true);

    // Third row: Ñoñez with no scores
    const r3 = result.rows[2];
    assert.equal(r3.cells['quiz-q1'].value, '—');
    assert.equal(r3.cells['quiz-q1'].missing, true);
    assert.equal(r3.cells['quiz-q2'].value, '—');
    assert.equal(r3.cells['quiz-q2'].missing, true);

    assert.equal(result.summary.students, 3);
  });

  it('live recompute: raising passing percent flips passed cells to failed', () => {
    const at75 = toTable(BASE_REPORT, { passingPercent: 75 });
    assert.equal(at75.rows[0].cells['quiz-q1'].passed, true);   // 80% >= 75%

    const at90 = toTable(BASE_REPORT, { passingPercent: 90 });
    assert.equal(at90.rows[0].cells['quiz-q1'].failed, true);   // 80% < 90%
    assert.equal(at90.rows[0].cells['quiz-q1'].passed, false);
    assert.equal(at90.rows[0].cells['quiz-q1'].value, '8/10 · 80%'); // value unchanged, only flag changes
  });

  it('column picker restricts columns', () => {
    const result = toTable(BASE_REPORT, {
      columns: ['num', 'lastName', 'firstName', 'average'],
    });
    assert.equal(result.columns.length, 4);
    assert.equal(result.columns[0].key, 'num');
    assert.equal(result.columns[1].key, 'lastName');
    assert.equal(result.columns[2].key, 'firstName');
    assert.equal(result.columns[3].key, 'average');
    // Row cells only contain picked columns
    assert.ok(result.rows[0].cells.num !== undefined);
    assert.ok(result.rows[0].cells.lastName !== undefined);
    assert.ok(result.rows[0].cells.firstName !== undefined);
    assert.ok(result.rows[0].cells.average !== undefined);
    assert.equal(result.rows[0].cells['quiz-q1'], undefined);
  });

  it('empty report returns empty columns and rows', () => {
    const result = toTable({
      subject: { id: 's1', code: 'X', name: 'X', passingPercent: 75 },
      quizzes: [],
      rows: [],
      summary: { students: 0, classAverage: 0, passRate: 0 },
    });
    assert.equal(result.columns.length, 7);
    assert.equal(result.rows.length, 0);
    assert.equal(result.summary.students, 0);
  });
});
