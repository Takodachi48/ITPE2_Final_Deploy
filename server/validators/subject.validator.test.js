import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSubjectSchema,
  updateSubjectSchema,
  enrollSchema,
  schoolYearSchema,
  subjectCodeSchema,
} from './subject.validator.js';

test('subjectCodeSchema upper-cases code', () => {
  assert.equal(subjectCodeSchema.parse('it101'), 'IT101');
  assert.equal(subjectCodeSchema.parse('  it 101  '), 'IT 101');
});

test('schoolYearSchema accepts consecutive years', () => {
  assert.equal(schoolYearSchema.parse('2026-2027'), '2026-2027');
});

test('schoolYearSchema rejects non-consecutive years', () => {
  assert.throws(() => schoolYearSchema.parse('2026-2028'), /one more/);
  assert.throws(() => schoolYearSchema.parse('2026-2026'), /one more/);
});

test('schoolYearSchema rejects bad format', () => {
  assert.throws(() => schoolYearSchema.parse('2026'), /YYYY-YYYY/);
  assert.throws(() => schoolYearSchema.parse('abcd-efgh'), /YYYY-YYYY/);
});

test('createSubjectSchema accepts valid input', () => {
  const result = createSubjectSchema.parse({
    code: 'it101',
    name: 'Intro to IT',
    term: '1st Semester',
    schoolYear: '2026-2027',
  });
  assert.equal(result.code, 'IT101');
  assert.equal(result.passingPercent, 75);
  assert.equal(result.term, '1st Semester');
});

test('createSubjectSchema rejects invalid term', () => {
  assert.throws(() => createSubjectSchema.parse({
    code: 'IT101',
    name: 'Intro',
    term: 'Fall',
    schoolYear: '2026-2027',
  }));
});

test('createSubjectSchema rejects passing percent out of range', () => {
  assert.throws(() => createSubjectSchema.parse({
    code: 'IT101',
    name: 'Intro',
    term: '1st Semester',
    schoolYear: '2026-2027',
    passingPercent: 0,
  }));
  assert.throws(() => createSubjectSchema.parse({
    code: 'IT101',
    name: 'Intro',
    term: '1st Semester',
    schoolYear: '2026-2027',
    passingPercent: 101,
  }));
});

test('createSubjectSchema rejects unknown keys', () => {
  assert.throws(() => createSubjectSchema.parse({
    code: 'IT101',
    name: 'Intro',
    term: '1st Semester',
    schoolYear: '2026-2027',
    extra: 'nope',
  }), /Unrecognized key/);
});

test('updateSubjectSchema requires at least one field', () => {
  assert.throws(() => updateSubjectSchema.parse({}), /at least one/);
});

test('enrollSchema requires joinCode', () => {
  assert.throws(() => enrollSchema.parse({}));
  assert.equal(enrollSchema.parse({ joinCode: 'ABC12345' }).joinCode, 'ABC12345');
});