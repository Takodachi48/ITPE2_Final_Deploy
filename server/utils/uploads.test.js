import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateUpload, checkImageMagicBytes, sanitizeFileName } from './uploads.js';

test('validateUpload: accepts valid PDF presentation', () => {
  const result = validateUpload('presentation', {
    fileName: 'slides.pdf',
    mime: 'application/pdf',
    size: 1024,
  });
  assert.equal(result.ok, true);
});

test('validateUpload: rejects exe renamed to pdf', () => {
  const result = validateUpload('presentation', {
    fileName: 'evil.pdf',
    mime: 'application/x-msdownload',
    size: 1024,
  });
  assert.equal(result.ok, false);
});

test('validateUpload: rejects wrong extension', () => {
  const result = validateUpload('presentation', {
    fileName: 'slides.exe',
    mime: 'application/pdf',
    size: 1024,
  });
  assert.equal(result.ok, false);
});

test('validateUpload: rejects oversized file', () => {
  const result = validateUpload('score-image', {
    fileName: 'photo.jpg',
    mime: 'image/jpeg',
    size: 10 * 1024 * 1024, // 10MB > 5MB limit
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /5 MB/);
});

test('validateUpload: accepts valid score image', () => {
  const result = validateUpload('score-image', {
    fileName: 'photo.jpg',
    mime: 'image/jpeg',
    size: 1024,
  });
  assert.equal(result.ok, true);
});

test('validateUpload: rejects unknown kind', () => {
  const result = validateUpload('unknown', {
    fileName: 'file.txt',
    mime: 'text/plain',
    size: 100,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unknown upload kind/);
});

test('checkImageMagicBytes: detects JPEG', () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(checkImageMagicBytes(buf), 'jpeg');
});

test('checkImageMagicBytes: detects PNG', () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  assert.equal(checkImageMagicBytes(buf), 'png');
});

test('checkImageMagicBytes: detects WebP', () => {
  const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(checkImageMagicBytes(buf), 'webp');
});

test('checkImageMagicBytes: rejects spoofed file', () => {
  const buf = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  assert.equal(checkImageMagicBytes(buf), false);
});

test('sanitizeFileName: strips path separators', () => {
  const result = sanitizeFileName('../../etc/passwd');
  assert.ok(!result.includes('/'));
  assert.ok(!result.includes('\\'));
});