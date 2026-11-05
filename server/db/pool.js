import pg from 'pg';
import { env, databaseConfigured } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { getPgConfig } from './config.js';

const { Pool } = pg;

let pool;
let poolError;
let queryCount = 0;

export function resetQueryCount() {
  queryCount = 0;
}

export function getQueryCount() {
  return queryCount;
}

const createPool = () => {
  try {
    const instance = new Pool({
      ...getPgConfig(),
      max: env.database.poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      query_timeout: 20_000,
      application_name: 'systems-index-api',
    });

    instance.on('error', (error) => {
      console.error('[db] Unexpected idle client error:', error.message);
    });

    return instance;
  } catch (error) {
    poolError = error;
    console.error('[db] Could not create the Postgres pool:', error.message);
    return null;
  }
};

export function getPool() {
  if (!databaseConfigured) {
    throw new AppError(
      503,
      'DATABASE_NOT_CONFIGURED',
      'The Postgres connection is not configured. Add DATABASE_URL to .env and restart the API.',
    );
  }

  if (!pool) pool = createPool();

  if (!pool) {
    throw new AppError(
      503,
      'DATABASE_INIT_FAILED',
      'The Postgres client could not be initialized. Check DATABASE_URL and SSL settings.',
    );
  }

  return pool;
}

export const dbQuery = (text, params = []) => {
  queryCount++;
  return getPool().query(text, params);
};

export async function withTransaction(work) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[db] Rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  if (!databaseConfigured) {
    return {
      status: 'not_configured',
      message: 'DATABASE_URL has not been configured.',
    };
  }

  try {
    await getPool().query('select 1');
    return { status: 'ok' };
  } catch (error) {
    const message =
      error.code === '42P01'
        ? 'The database schema has not been applied yet.'
        : error.message;

    return { status: 'error', message };
  }
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}

export { poolError };
