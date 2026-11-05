import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../lib/errors.js';
import { originGuard } from './originGuard.js';

function mockReq(method, headers = {}) {
  return { method, headers };
}

test('originGuard allows GET requests', () => {
  let captured;
  const req = mockReq('GET', { origin: 'https://evil.com' });
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});

test('originGuard allows POST with allowed origin', () => {
  let captured;
  const req = mockReq('POST', {
    origin: 'http://localhost:5173',
    'content-type': 'application/json',
    'content-length': '10',
  });
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});

test('originGuard allows POST with no origin (curl)', () => {
  let captured;
  const req = mockReq('POST', {
    'content-type': 'application/json',
    'content-length': '10',
  });
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});

test('originGuard rejects POST with foreign origin', () => {
  let captured;
  const req = mockReq('POST', {
    origin: 'https://evil.com',
    'content-type': 'application/json',
    'content-length': '10',
  });
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.ok(captured instanceof AppError);
  assert.equal(captured.status, 403);
  assert.equal(captured.code, 'ORIGIN_NOT_ALLOWED');
});

test('originGuard rejects POST with non-JSON content type', () => {
  let captured;
  const req = mockReq('POST', {
    'content-type': 'text/plain',
    'content-length': '10',
  });
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.ok(captured instanceof AppError);
  assert.equal(captured.status, 403);
  assert.equal(captured.code, 'ORIGIN_NOT_ALLOWED');
});

test('originGuard allows POST with no body (no content-type check)', () => {
  let captured;
  const req = mockReq('POST', {});
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});

test('originGuard allows PUT with allowed origin', () => {
  let captured;
  const req = mockReq('PUT', {
    origin: 'http://localhost:5173',
    'content-type': 'application/json',
    'content-length': '5',
  });
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});

test('originGuard allows DELETE with no origin', () => {
  let captured;
  const req = mockReq('DELETE', {});
  originGuard(req, {}, (arg) => { captured = arg; });
  assert.equal(captured, undefined);
});