// server/scripts/cleanup-orphans.js
// Deletes storage objects that have no matching DB row and are older than 24 h.
// Dry-run by default. Pass --apply to actually remove objects.
// Usage: node server/scripts/cleanup-orphans.js [--apply]
import pg from 'pg';
import { getServiceClient } from '../lib/supabase.js';
import { databaseConfigured, env, supabaseServiceConfigured } from '../config/env.js';
import { getPgConfig } from '../db/config.js';

const { Client } = pg;

const AGE_MS = 24 * 60 * 60 * 1000;
const apply = process.argv.includes('--apply');

function isExpired(item) {
  if (!item.updated_at) return false;
  return Date.now() - new Date(item.updated_at).getTime() > AGE_MS;
}

/**
 * Recursively list every file object in a bucket.
 * Supabase `list()` returns one directory level; folders have id === null.
 */
async function listAllFiles(bucket, prefix = '') {
  const files = [];
  const stack = [prefix];
  while (stack.length) {
    const current = stack.pop();
    const { data, error } = await getServiceClient()
      .storage
      .from(bucket)
      .list(current, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${current || '(root)'}: ${error.message}`);
    for (const item of data || []) {
      if (item.id === null) {
        stack.push(item.name); // folder
      } else {
        files.push(item); // file; item.path is the full path
      }
    }
  }
  return files;
}

async function main() {
  if (!databaseConfigured) {
    console.error('DATABASE_URL is missing or still contains a placeholder.');
    process.exit(1);
  }
  if (!supabaseServiceConfigured) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required.');
    process.exit(1);
  }

  const client = new Client({ ...getPgConfig(), application_name: 'systems-storage-cleanup' });
  await client.connect();

  try {
    // Collect all valid storage paths from the database.
    const { rows: contentRows } = await client.query(
      `select file_path from public.topic_content where file_path is not null`,
    );
    const { rows: attemptRows } = await client.query(
      `select image_path from public.attempts where image_path is not null`,
    );
    const { rows: quizRows } = await client.query(
      `select attachment_path from public.quizzes where attachment_path is not null`,
    );

    const validPaths = new Set();
    for (const r of contentRows) if (r.file_path) validPaths.add(r.file_path);
    for (const r of attemptRows) if (r.image_path) validPaths.add(r.image_path);
    for (const r of quizRows) if (r.attachment_path) validPaths.add(r.attachment_path);

    console.log(`[cleanup] ${validPaths.size} valid storage paths in database.`);

    let orphaned = 0;
    let deleted = 0;
    let errors = 0;

    for (const bucket of [env.storage.topicBucket, env.storage.uploadBucket]) {
      const files = await listAllFiles(bucket);
      console.log(`[cleanup] bucket ${bucket}: ${files.length} objects.`);

      for (const file of files) {
        if (validPaths.has(file.path)) continue;
        if (!isExpired(file)) continue;

        orphaned += 1;
        console.log(
          `  [${apply ? 'DELETE' : 'DRY-RUN'}] ${bucket}/${file.path} (updated ${file.updated_at})`,
        );

        if (apply) {
          const { error } = await getServiceClient()
            .storage
            .from(bucket)
            .remove([file.path]);
          if (error) {
            errors += 1;
            console.error(`    remove failed: ${error.message}`);
          } else {
            deleted += 1;
          }
        }
      }
    }

    console.log(
      `[cleanup] Done: ${orphaned} orphan(s) older than 24 h, ${deleted} deleted, ${errors} error(s).`,
    );
    if (!apply) {
      console.log('[cleanup] Dry-run only. Re-run with --apply to delete.');
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[cleanup] Failed:', error.message);
  process.exitCode = 1;
});
