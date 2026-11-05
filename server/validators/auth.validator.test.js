import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from './auth.validator.js';

test('registerSchema accepts valid student', () => {
  const result = registerSchema.parse({
    role: 'student',
    email: '  Test@Example.COM  ',
    password: 'password123',
    firstName: '  John  ',
    lastName: '  Doe  ',
    studentNumber: 'ABC-1234',
  });
  assert.equal(result.email, 'test@example.com');
  assert.equal(result.firstName, 'John');
  assert.equal(result.lastName, 'Doe');
});

test('registerSchema accepts valid faculty without studentNumber', () => {
  const result = registerSchema.parse({
    role: 'faculty',
    email: 'faculty@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith',
  });
  assert.equal(result.role, 'faculty');
});

test('registerSchema rejects short password', () => {
  assert.throws(() => registerSchema.parse({
    role: 'student',
    email: 'a@b.com',
    password: 'short',
    firstName: 'A',
    lastName: 'B',
    studentNumber: 'ABCD',
  }), /at least 8/);
});

test('registerSchema rejects missing studentNumber for student', () => {
  assert.throws(() => registerSchema.parse({
    role: 'student',
    email: 'a@b.com',
    password: 'password123',
    firstName: 'A',
    lastName: 'B',
  }), /Student number is required/);
});

test('registerSchema rejects invalid studentNumber format', () => {
  assert.throws(() => registerSchema.parse({
    role: 'student',
    email: 'a@b.com',
    password: 'password123',
    firstName: 'A',
    lastName: 'B',
    studentNumber: 'AB',
  }), /4 to 20/);
});

test('registerSchema rejects unknown keys', () => {
  assert.throws(() => registerSchema.parse({
    role: 'student',
    email: 'a@b.com',
    password: 'password123',
    firstName: 'A',
    lastName: 'B',
    studentNumber: 'ABCD',
    extraField: 'nope',
  }), /Unrecognized key/);
});

test('registerSchema rejects invalid role', () => {
  assert.throws(() => registerSchema.parse({
    role: 'admin',
    email: 'a@b.com',
    password: 'password123',
    firstName: 'A',
    lastName: 'B',
  }));
});

test('registerSchema rejects empty names', () => {
  assert.throws(() => registerSchema.parse({
    role: 'faculty',
    email: 'a@b.com',
    password: 'password123',
    firstName: '',
    lastName: 'B',
  }), /required/);
});

test('registerSchema rejects long names', () => {
  assert.throws(() => registerSchema.parse({
    role: 'faculty',
    email: 'a@b.com',
    password: 'password123',
    firstName: 'A'.repeat(61),
    lastName: 'B',
  }), /60 characters/);
});