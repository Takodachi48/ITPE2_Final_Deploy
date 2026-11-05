import { readFile } from 'node:fs/promises';
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

const schema = await readFile(
  new URL('../db/schema.sql', import.meta.url),
  'utf8',
);

const client = new Client({
  ...getPgConfig(),
  application_name: 'systems-index-schema',
});

try {
  await client.connect();
  console.log(`[db] Applying schema to ${env.database.url.replace(/\/\/.*@/, '//***@')}`);

  await client.query('begin');
  await client.query(schema);
  await client.query('commit');

  console.log('[db] Schema applied successfully.');
} catch (error) {
  try {
    await client.query('rollback');
  } catch {
    // The connection may have failed before the transaction began.
  }

  console.error('[db] Schema failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
