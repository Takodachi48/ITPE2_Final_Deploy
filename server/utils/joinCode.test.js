import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateJoinCode } from './joinCode.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

test('generateJoinCode produces 8 characters by default', () => {
  const code = generateJoinCode();
  assert.equal(code.length, 8);
});

test('generateJoinCode produces requested length', () => {
  assert.equal(generateJoinCode(12).length, 12);
  assert.equal(generateJoinCode(1).length, 1);
});

test('generateJoinCode uses only allowed alphabet', () => {
  for (let i = 0; i < 100; i++) {
    const code = generateJoinCode();
    for (const ch of code) {
      assert.ok(ALPHABET.includes(ch), `unexpected char ${ch}`);
    }
  }
});

test('generateJoinCode excludes ambiguous characters', () => {
  for (let i = 0; i < 100; i++) {
    const code = generateJoinCode();
    assert.ok(!/[0O1IL]/.test(code), 'ambiguous char found');
  }
});

test('generateJoinCode produces different codes (distribution sanity)', () => {
  const codes = new Set();
  for (let i = 0; i < 50; i++) {
    codes.add(generateJoinCode());
  }
  // With 8 chars from 32-char alphabet, collisions in 50 draws are extremely unlikely.
  assert.ok(codes.size >= 45, `too many collisions: ${codes.size}/50 unique`);
});