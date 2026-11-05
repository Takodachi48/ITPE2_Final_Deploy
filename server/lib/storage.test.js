import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildObjectPath } from '../lib/storage.js';

test('buildObjectPath: topic-file produces correct path', () => {
  const path = buildObjectPath('topic-file', { subjectId: 'subj-1', topicId: 'topic-1' }, 'slides.pdf');
  assert.match(path, /^subjects\/subj-1\/topics\/topic-1\/[0-9a-f-]+-slides\.pdf$/);
});

test('buildObjectPath: strips path separators from filename', () => {
  const path = buildObjectPath('topic-file', { subjectId: 's', topicId: 't' }, '../../etc/passwd');
  assert.ok(!path.includes('/etc/'));
  assert.ok(!path.includes('\\'));
});

test('buildObjectPath: sanitizes special characters', () => {
  const path = buildObjectPath('topic-file', { subjectId: 's', topicId: 't' }, 'my file (1).pdf');
  assert.ok(!path.includes(' '));
  assert.ok(!path.includes('('));
});

test('buildObjectPath: quiz-upload produces correct path', () => {
  const path = buildObjectPath('quiz-upload', { subjectId: 's', quizId: 'q', studentId: 'st' }, 'photo.jpg');
  assert.match(path, /^subjects\/s\/quizzes\/q\/st\/[0-9a-f-]+\./);
});

test('buildObjectPath: throws on unknown kind', () => {
  assert.throws(() => buildObjectPath('unknown', { subjectId: 's' }, 'file.txt'), /Unknown storage kind/);
});

test('buildObjectPath: handles empty filename', () => {
  const path = buildObjectPath('topic-file', { subjectId: 's', topicId: 't' }, '');
  assert.ok(path.includes('file'));
});