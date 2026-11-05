import { createApp } from './app.js';
import {
  databaseConfigured,
  env,
  supabaseConfigured,
} from './config/env.js';
import { closePool } from './db/pool.js';

const app = createApp();
const server = app.listen(env.port, env.host, () => {
  console.log(`[api] Systems Index API listening on port ${env.port} (${env.nodeEnv}).`);

  if (!databaseConfigured) {
    console.warn(
      '[api] DATABASE_URL is not configured. Public content endpoints will return 503 and the web app will use its bundled fallback data.',
    );
  }

  if (!supabaseConfigured) {
    console.warn(
      '[api] Supabase Auth is not configured. Authentication endpoints will return 503.',
    );
  }
});

server.requestTimeout = 30_000;

const shutdown = (signal) => {
  console.log(`[api] ${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      await closePool();
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
