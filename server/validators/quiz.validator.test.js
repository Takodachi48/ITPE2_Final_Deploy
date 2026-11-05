import { test } from 'node:test';
import assert from 'node:assert/strict';

import { choiceQuestionSchema, textQuestionSchema, questionSchema, importPayloadSchema } from './quiz.validator.js';

test('choice: needs 2-6 options and one correct', () => {
  const ok = choiceQuestionSchema.safeParse({
    type: 'choice',
    prompt: 'Pick one',
    options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
    correctOptionIndex: 0,
  });
  assert.equal(ok.success, true);

  const tooFew = choiceQuestionSchema.safeParse({
    type: 'choice',
    prompt: 'Pick one',
    options: [{ label: 'A' }],
    correctOptionIndex: 0,
  });
  assert.equal(tooFew.success, false);

  const badIndex = choiceQuestionSchema.safeParse({
    type: 'choice',
    prompt: 'Pick one',
    options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
    correctOptionIndex: 5,
  });
  assert.equal(badIndex.success, false);
});

test('text: needs at least one accepted answer', () => {
  const ok = textQuestionSchema.safeParse({
    type: 'text',
    prompt: 'Name it',
    acceptedAnswers: ['foo'],
  });
  assert.equal(ok.success, true);

  const none = textQuestionSchema.safeParse({
    type: 'text',
    prompt: 'Name it',
    acceptedAnswers: [],
  });
  assert.equal(none.success, false);
});

test('questionSchema discriminated union', () => {
  const c = questionSchema.safeParse({ type: 'choice', prompt: 'p', options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }], correctOptionIndex: 1 });
  assert.equal(c.success, true);
  const t = questionSchema.safeParse({ type: 'text', prompt: 'p', acceptedAnswers: ['x'] });
  assert.equal(t.success, true);
  const bad = questionSchema.safeParse({ type: 'unknown', prompt: 'p' });
  assert.equal(bad.success, false);
});

test('importPayloadSchema: row-level validation via array', () => {
  const ok = importPayloadSchema.safeParse({
    questions: [
      { type: 'choice', prompt: 'p', options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }], correctOptionIndex: 0 },
    ],
  });
  assert.equal(ok.success, true);

  const tooMany = importPayloadSchema.safeParse({
    questions: Array.from({ length: 21 }, () => ({ type: 'text', prompt: 'p', acceptedAnswers: ['x'] })),
  });
  assert.equal(tooMany.success, false);

  const empty = importPayloadSchema.safeParse({ questions: [] });
  assert.equal(empty.success, false);
});

test('points must be positive', () => {
  const bad = choiceQuestionSchema.safeParse({
    type: 'choice',
    prompt: 'p',
    options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }],
    correctOptionIndex: 0,
    points: 0,
  });
  assert.equal(bad.success, false);
});