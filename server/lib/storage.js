// server/lib/storage.js
import crypto from 'node:crypto';
import { getServiceClient } from './supabase.js';
import { env } from '../config/env.js';

function sanitizeFileName(name) {
  if (!name) return 'file';
  return String(name)
    .replace(/[/\\]/g, '')
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'file';
}

export function buildObjectPath(kind, ids, fileName) {
  const safe = sanitizeFileName(fileName);
  const uuid = crypto.randomUUID();

  switch (kind) {
    case 'topic-file':
    case 'quiz-attachment':
      return `subjects/${ids.subjectId}/topics/${ids.topicId}/${uuid}-${safe}`;
    case 'quiz-upload':
      return `subjects/${ids.subjectId}/quizzes/${ids.quizId}/${ids.studentId}/${uuid}.${safe.split('.').pop() || 'bin'}`;
    default:
      throw new Error(`Unknown storage kind: ${kind}`);
  }
}

export async function createUploadUrl(bucket, path) {
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);
  if (error) throw new Error(`createUploadUrl: ${error.message}`);
  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

export async function createDownloadUrl(bucket, path, expiresIn) {
  const ttl = expiresIn ?? env.storage.signedUrlTtlSeconds;
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, ttl);
  if (error) throw new Error(`createDownloadUrl: ${error.message}`);
  return data.signedUrl;
}

export async function objectInfo(bucket, path) {
  const client = getServiceClient();
  const { data, error } = await client.storage.from(bucket).info(path);
  if (error) return null;
  return data;
}

export async function downloadObject(bucket, path) {
  const client = getServiceClient();
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeObject(bucket, path) {
  const client = getServiceClient();
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) throw new Error(`removeObject: ${error.message}`);
  return true;
}
