import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeText, gradeQuestion, gradeAttempt, isPassed, computePercent } from './grading.js';

test('normalizeText: trims, collapses spaces, lowercases, NFKC', () => {
  assert.equal(normalizeText('  Hello   World  '), 'hello world');
  assert.equal(normalizeText('CAFÉ'), 'café');
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeText(undefined), '');
});

test('normalizeText: accented text normalizes', () => {
  // NFKC compatibility
  assert.equal(normalizeText('ﬁ'), 'fi');
});

test('gradeQuestion: choice correct', () => {
  const q = { type: 'choice', points: 1, correctOptionId: 'b' };
  assert.equal(gradeQuestion(q, 'b'), 1);
  assert.equal(gradeQuestion(q, 'a'), 0);
});

test('gradeQuestion: choice unanswered', () => {
  const q = { type: 'choice', points: 2, correctOptionId: 'b' };
  assert.equal(gradeQuestion(q, null), 0);
  assert.equal(gradeQuestion(q, ''), 0);
});

test('gradeQuestion: text accepted answer (accented + spaces)', () => {
  const q = { type: 'text', points: 1, acceptedAnswers: ['  Café  ', 'coffee'] };
  assert.equal(gradeQuestion(q, 'café'), 1);
  assert.equal(gradeQuestion(q, '  COFFEE  '), 1);
  assert.equal(gradeQuestion(q, 'tea'), 0);
});

test('gradeQuestion: text with extra internal spaces matches', () => {
  const q = { type: 'text', points: 1, acceptedAnswers: ['hello world'] };
  assert.equal(gradeQuestion(q, 'hello   world'), 1);
});

test('gradeQuestion: text unanswered returns 0', () => {
  const q = { type: 'text', points: 1, acceptedAnswers: ['yes'] };
  assert.equal(gradeQuestion(q, ''), 0);
  assert.equal(gradeQuestion(q, null), 0);
});

test('gradeQuestion: no accepted answers returns 0', () => {
  const q = { type: 'text', points: 1, acceptedAnswers: [] };
  assert.equal(gradeQuestion(q, 'yes'), 0);
});

test('gradeAttempt: sums scores and totals (array aligned)', () => {
  const qs = [
    { id: 'q1', type: 'choice', points: 1, correctOptionId: 'a' },
    { id: 'q2', type: 'text', points: 2, acceptedAnswers: ['yes'] },
  ];
  const answers = ['a', 'yes'];
  const { score, total } = gradeAttempt(qs, answers);
  assert.equal(score, 3);
  assert.equal(total, 3);
});

test('gradeAttempt: object map by questionId', () => {
  const qs = [
    { id: 'q1', type: 'choice', points: 1, correctOptionId: 'a' },
  ];
  const answers = { q1: 'a' };
  const { score, total } = gradeAttempt(qs, answers);
  assert.equal(score, 1);
  assert.equal(total, 1);
});

test('gradeAttempt: unanswered scores 0', () => {
  const qs = [
    { id: 'q1', type: 'choice', points: 1, correctOptionId: 'a' },
  ];
  const { score, total } = gradeAttempt(qs, []);
  assert.equal(score, 0);
  assert.equal(total, 1);
});

test('gradeAttempt: decimals points', () => {
  const qs = [
    { id: 'q1', type: 'choice', points: 1.5, correctOptionId: 'a' },
    { id: 'q2', type: 'choice', points: 0.5, correctOptionId: 'b' },
  ];
  const answers = ['a', 'x'];
  const { score, total } = gradeAttempt(qs, answers);
  assert.equal(score, 1.5);
  assert.equal(total, 2);
});

test('gradeAttempt: empty questions', () => {
  const { score, total } = gradeAttempt([], []);
  assert.equal(score, 0);
  assert.equal(total, 0);
});

test('isPassed: boundary 7.5/10 at 75 -> passed', () => {
  assert.equal(isPassed(7.5, 10, 75), true);
});

test('isPassed: 7/10 at 75 -> not passed', () => {
  assert.equal(isPassed(7, 10, 75), false);
});

test('isPassed: 0 total -> not passed', () => {
  assert.equal(isPassed(0, 0, 75), false);
  assert.equal(isPassed(5, 0, 75), false);
});

test('isPassed: 100% passes', () => {
  assert.equal(isPassed(10, 10, 75), true);
});

test('isPassed: passing percent 90, score 8/10 -> not passed', () => {
  assert.equal(isPassed(8, 10, 90), false);
});

test('isPassed: float safety', () => {
  // 0.1 + 0.2 style
  assert.equal(isPassed(0.3, 0.3, 100), true);
});

test('computePercent: display percent', () => {
  assert.equal(computePercent(7.5, 10), 75);
  assert.equal(computePercent(1, 3), 33.33);
  assert.equal(computePercent(0, 0), 0);
});