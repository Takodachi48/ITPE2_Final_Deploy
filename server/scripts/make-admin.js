import pg from 'pg';
import { databaseConfigured } from '../config/env.js';
import { getPgConfig } from '../db/config.js';

const { Client } = pg;
const email = process.argv[2]?.trim();

if (!email) {
  console.error('Usage: npm run make:admin -- you@example.com');
  process.exit(1);
}

if (!databaseConfigured) {
  console.error(
    'DATABASE_URL is missing or still contains a placeholder. Add your Supabase Postgres connection string to .env first.',
  );
  process.exit(1);
}

const client = new Client({
  ...getPgConfig(),
  application_name: 'systems-index-make-admin',
});

try {
  await client.connect();

  const { rows: profiles } = await client.query(
    `select id, email, role
       from public.profiles
      where lower(email) = lower($1)
      limit 1`,
    [email],
  );

  if (!profiles[0]) {
    const { rows: authUsers } = await client.query(
      `select id, email from auth.users where lower(email) = lower($1) limit 1`,
      [email],
    );

    if (authUsers[0]) {
      throw new Error(
        'The auth user exists but has no profile. Run npm run db:schema so the auth trigger is installed.',
      );
    }

    throw new Error(
      'No Supabase Auth user has that email. Create the user in Supabase Dashboard > Authentication > Users first.',
    );
  }

  const { rows } = await client.query(
    `update public.profiles
        set role = 'admin',
            updated_at = now()
      where id = $1
      returning id, email, role`,
    [profiles[0].id],
  );

  console.log(`[auth] ${rows[0].email} is now an admin.`);
} catch (error) {
  console.error('[auth] Could not promote the user:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
