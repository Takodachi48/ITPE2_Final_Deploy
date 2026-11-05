import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateSchedule } from './schedule.js';

test('generateSchedule: basic Tue/Thu from a start date', () => {
  // 2026-11-03 is a Tuesday
  const dates = generateSchedule(4, '2026-11-03', [2, 4], 'Asia/Manila');
  assert.equal(dates.length, 4);
  // Tue, Thu, Tue, Thu
  assert.equal(dates[0], '2026-11-03'); // Tue
  assert.equal(dates[1], '2026-11-05'); // Thu
  assert.equal(dates[2], '2026-11-10'); // Tue
  assert.equal(dates[3], '2026-11-12'); // Thu
});

test('generateSchedule: start date counts if it matches', () => {
  // 2026-11-04 is a Wednesday
  const dates = generateSchedule(1, '2026-11-04', [3], 'Asia/Manila');
  assert.equal(dates.length, 1);
  assert.equal(dates[0], '2026-11-04');
});

test('generateSchedule: start date skipped if not in meetingDays', () => {
  // 2026-11-03 is Tuesday, meeting on Wed
  const dates = generateSchedule(1, '2026-11-03', [3], 'Asia/Manila');
  assert.equal(dates.length, 1);
  assert.equal(dates[0], '2026-11-04'); // next Wed
});

test('generateSchedule: count 1 returns single date', () => {
  const dates = generateSchedule(1, '2026-11-03', [2], 'Asia/Manila');
  assert.equal(dates.length, 1);
});

test('generateSchedule: handles month boundary', () => {
  // Start near end of month
  const dates = generateSchedule(3, '2026-10-29', [4, 5], 'Asia/Manila'); // Thu, Fri
  assert.equal(dates.length, 3);
  // Should cross into November
  assert.ok(dates.some((d) => d.startsWith('2026-11')));
});

test('generateSchedule: handles year boundary', () => {
  const dates = generateSchedule(3, '2026-12-30', [3, 4], 'Asia/Manila');
  assert.equal(dates.length, 3);
  // Should cross into January 2027
  assert.ok(dates.some((d) => d.startsWith('2027')));
});

test('generateSchedule: empty meetingDays returns empty', () => {
  const dates = generateSchedule(5, '2026-11-03', [], 'Asia/Manila');
  assert.equal(dates.length, 0);
});

test('generateSchedule: count 0 returns empty', () => {
  const dates = generateSchedule(0, '2026-11-03', [2], 'Asia/Manila');
  assert.equal(dates.length, 0);
});

test('generateSchedule: all 7 days', () => {
  const dates = generateSchedule(7, '2026-11-03', [0, 1, 2, 3, 4, 5, 6], 'Asia/Manila');
  assert.equal(dates.length, 7);
  // Should be 7 consecutive days
  assert.equal(dates[0], '2026-11-03');
  assert.equal(dates[6], '2026-11-09');
});

test('generateSchedule: count 40 (max)', () => {
  const dates = generateSchedule(40, '2026-11-03', [2, 4], 'Asia/Manila');
  assert.equal(dates.length, 40);
});