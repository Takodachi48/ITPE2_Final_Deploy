import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { databaseConfigured, env } from '../config/env.js';
import { getPgConfig } from '../db/config.js';

const { Client } = pg;

if (!databaseConfigured) {
  console.error(
    'DATABASE_URL is missing or still contains a placeholder. Add your Supabase Postgres connection string to .env first.',
  );
  process.exit(1);
}

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'db',
  'migrations',
);

const client = new Client({
  ...getPgConfig(),
  application_name: 'systems-index-migrate',
});

try {
  await client.connect();
  console.log(
    `[db] Migrating ${env.database.url.replace(/\/\/.*@/, '//***@')}`,
  );

  // Bootstrap the bookkeeping table (idempotent). Migrations themselves are
  // expected to be idempotent too, but the runner also skips applied files.
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  let files = [];
  try {
    files = (await readdir(migrationsDir))
      .filter((name) => /^\d{3,}_.*\.sql$/i.test(name))
      .sort();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const { rows } = await client.query(
    'select filename from public.schema_migrations',
  );
  const applied = new Set(rows.map((row) => row.filename));

  let ran = 0;
  let skipped = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[db] skip (already applied): ${file}`);
      skipped += 1;
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`[db] applying: ${file}`);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into public.schema_migrations (filename) values ($1)',
        [file],
      );
      await client.query('commit');
      ran += 1;
    } catch (error) {
      try {
        await client.query('rollback');
      } catch {
        // The transaction may not have started.
      }
      throw new Error(`${file}: ${error.message}`);
    }
  }

  console.log(`[db] Done. Applied ${ran}, skipped ${skipped}.`);
} catch (error) {
  console.error('[db] Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
