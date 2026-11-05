import { test } from 'node:test';
import assert from 'node:assert/strict';

import { slugify } from './slug.js';

test('slugify lowercases and hyphenates spaces', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('slugify strips accents', () => {
  assert.equal(slugify('Café Münster'), 'cafe-munster');
});

test('slugify replaces ampersands with "and"', () => {
  assert.equal(slugify('Tom & Jerry'), 'tom-and-jerry');
});

test('slugify collapses non-alphanumeric runs into one hyphen', () => {
  assert.equal(slugify('a!!!b___c'), 'a-b-c');
});

test('slugify trims leading/trailing hyphens', () => {
  assert.equal(slugify('---hello---'), 'hello');
});

test('slugify falls back to "module" for empty input', () => {
  assert.equal(slugify(''), 'module');
  assert.equal(slugify('!!!'), 'module');
});

test('slugify truncates to 80 characters', () => {
  const long = 'a'.repeat(200);
  assert.ok(slugify(long).length <= 80);
});
