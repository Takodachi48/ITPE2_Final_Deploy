// server/utils/uploads.js
import { env } from '../config/env.js';

const ALLOWED = {
  presentation: {
    extensions: ['.pdf', '.pptx'],
    mimes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    maxSizeMb: () => env.storage.maxFileMb,
  },
  file: {
    extensions: ['.pdf', '.pptx', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp'],
    mimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp',
    ],
    maxSizeMb: () => env.storage.maxFileMb,
  },
  'quiz-attachment': {
    extensions: ['.pdf', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.webp'],
    mimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
    maxSizeMb: () => env.storage.maxFileMb,
  },
  'score-image': {
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeMb: () => env.storage.maxImageMb,
  },
};

export function sanitizeFileName(name) {
  if (!name) return 'file';
  return String(name)
    .replace(/[/\\]/g, '')
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'file';
}

export function validateUpload(kind, { fileName, mime, size }) {
  const config = ALLOWED[kind];
  if (!config) {
    return { ok: false, reason: `Unknown upload kind: ${kind}` };
  }

  const ext = (fileName || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  if (!config.extensions.includes(ext)) {
    return { ok: false, reason: `File type ${ext || '(none)'} is not allowed for ${kind}.` };
  }

  if (!config.mimes.includes(mime)) {
    return { ok: false, reason: `MIME type ${mime} is not allowed for ${kind}.` };
  }

  const maxBytes = config.maxSizeMb() * 1024 * 1024;
  if (size > maxBytes) {
    return { ok: false, reason: `File exceeds the ${config.maxSizeMb()} MB limit.` };
  }

  return { ok: true, sanitized: sanitizeFileName(fileName) };
}

export function checkImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 3) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  // WebP: RIFF....WEBP
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'webp';
  return false;
}