// src/lib/export.test.js
// RPT-12: export tests. Row arrays for report/per-student exports are
// covered via toTable; exports must contain no internal ids or answer keys.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv } from './exportCsv.js';

const BASE_REPORT = {
  subject: {
    id: 's1',
    code: 'IT101',
    name: 'Intro to Tech',
    term: '1st Semester',
    schoolYear: '2026-2027',
    passingPercent: 75,
  },
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

describe('buildCsv', () => {
  it('produces header row matching preview columns', () => {
    const csv = buildCsv(BASE_REPORT);
    const header = csv.split('\r\n')[0];
    assert.ok(header.includes('#'));
    assert.ok(header.includes('Student number'));
    assert.ok(header.includes('Surname'));
    assert.ok(header.includes('First name'));
    assert.ok(header.includes('Topic 1'));
    assert.ok(header.includes('Topic 2'));
    assert.ok(header.includes('Average'));
    assert.ok(header.includes('Passed'));
    assert.ok(header.includes('Remark'));
  });

  it('does not expose internal ids or answer keys', () => {
    const csv = buildCsv(BASE_REPORT);
    assert.ok(!csv.includes('st1'));
    assert.ok(!csv.includes('st2'));
    assert.ok(!csv.includes('st3'));
    assert.ok(!csv.includes('q1'));
    assert.ok(!csv.includes('q2'));
    assert.ok(!csv.includes('t1'));
    assert.ok(!csv.includes('t2'));
    assert.ok(!csv.includes('answers'));
    assert.ok(!csv.includes('acceptedAnswers'));
    assert.ok(!csv.includes('correctOptionId'));
  });

  it('marks failed cells with × symbol', () => {
    const csv = buildCsv(BASE_REPORT);
    // Zulu scored 5/10 = 50% < 75% → failed
    assert.ok(csv.includes('× 5/10 · 50%'));
  });

  it('shows missing cells as —', () => {
    const csv = buildCsv(BASE_REPORT);
    // Zulu's q2 is null → missing
    assert.ok(csv.includes('—'));
  });

  it('preserves accented characters (ñ)', () => {
    const csv = buildCsv(BASE_REPORT);
    assert.ok(csv.includes('Ñoñez'));
  });

  it('row arrays match toTable output', () => {
    const csv = buildCsv(BASE_REPORT);
    const lines = csv.split('\r\n');
    // First data row after header → Acosta
    assert.ok(lines[1].includes('Acosta'));
    assert.ok(lines[1].includes('TUPT-23-0001'));
    assert.ok(lines[1].includes('Girone'));
    assert.ok(lines[1].includes('8/10 · 80%'));
    assert.ok(lines[1].includes('15/20 · 75%'));
    assert.ok(lines[1].includes('77.5'));
    assert.ok(lines[1].includes('2/2'));
    assert.ok(lines[1].includes('Passed'));
  });

  it('live recompute: raising passing percent flips cells to failed in CSV', () => {
    const at75 = buildCsv(BASE_REPORT);
    assert.ok(at75.includes('8/10 · 80%')); // 80% >= 75%, no ×

    const at90 = buildCsv(BASE_REPORT, { passingPercent: 90 });
    assert.ok(at90.includes('× 8/10 · 80%')); // 80% < 90%, failed
  });
});
