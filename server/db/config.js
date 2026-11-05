import { env, databaseConfigured } from '../config/env.js';

export const isDatabaseConfigured = () => databaseConfigured;

export function getSslConfig() {
  if (!env.database.ssl) return false;

  return {
    rejectUnauthorized: env.database.sslRejectUnauthorized,
  };
}

export function getPgConfig(overrides = {}) {
  return {
    connectionString: env.database.url,
    ssl: getSslConfig(),
    ...overrides,
  };
}
