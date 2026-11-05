import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../lib/errors.js';
import { requireRole, requireApproved } from './auth.js';

function mockReq(profile) {
  return { auth: profile ? { profile } : undefined };
}

test('requireRole allows matching role', () => {
  const mw = requireRole('faculty');
  const req = mockReq({ role: 'faculty', approvalStatus: 'approved' });
  const result = mw(req, {}, (arg) => arg);
  // sync middleware calls next() with no arg on success
  assert.equal(result, undefined);
});

test('requireRole rejects non-matching role with ROLE_FORBIDDEN', () => {
  const mw = requireRole('faculty');
  let captured;
  const req = mockReq({ role: 'student', approvalStatus: 'approved' });
  mw(req, {}, (arg) => { captured = arg; });
  assert.ok(captured instanceof AppError);
  assert.equal(captured.status, 403);
  assert.equal(captured.code, 'ROLE_FORBIDDEN');
});

test('requireRole rejects missing auth with AUTH_REQUIRED', () => {
  const mw = requireRole('faculty');
  let captured;
  mw(mockReq(null), {}, (arg) => { captured = arg; });
  assert.ok(captured instanceof AppError);
  assert.equal(captured.status, 401);
  assert.equal(captured.code, 'AUTH_REQUIRED');
});

test('requireApproved allows approved faculty', () => {
  let captured;
  const req = mockReq({ role: 'faculty', approvalStatus: 'approved' });
  requireApproved(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});

test('requireApproved allows admin regardless of approval status', () => {
  let captured;
  const req = mockReq({ role: 'admin', approvalStatus: 'pending' });
  requireApproved(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});

test('requireApproved rejects pending faculty with APPROVAL_PENDING', () => {
  let captured;
  const req = mockReq({ role: 'faculty', approvalStatus: 'pending' });
  requireApproved(req, {}, (arg) => { captured = arg; });
  assert.ok(captured instanceof AppError);
  assert.equal(captured.status, 403);
  assert.equal(captured.code, 'APPROVAL_PENDING');
});

test('requireApproved rejects missing auth with AUTH_REQUIRED', () => {
  let captured;
  requireApproved(mockReq(null), {}, (arg) => { captured = arg; });
  assert.ok(captured instanceof AppError);
  assert.equal(captured.status, 401);
  assert.equal(captured.code, 'AUTH_REQUIRED');
});