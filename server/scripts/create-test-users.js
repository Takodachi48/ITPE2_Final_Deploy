import pg from 'pg';
import { env, databaseConfigured, supabaseServiceConfigured } from '../config/env.js';
import { getPgConfig } from '../db/config.js';
import { getServiceClient } from '../lib/supabase.js';

const { Client } = pg;
if (env.nodeEnv === 'production') { console.error('[test-users] Refusing to run in NODE_ENV=production.'); process.exit(1); }
if (!databaseConfigured) { console.error('[test-users] DATABASE_URL is missing.'); process.exit(1); }
if (!supabaseServiceConfigured) { console.error('[test-users] SUPABASE_SERVICE_ROLE_KEY is required.'); process.exit(1); }

const PASSWORD = 'Password123';
const USERS = [
  { email: 'test_admin@example.com', role: 'admin', approvalStatus: 'approved', firstName: 'Test', lastName: 'Admin', studentNumber: null },
  { email: 'test_faculty@example.com', role: 'faculty', approvalStatus: 'approved', firstName: 'Test', lastName: 'Faculty', studentNumber: null },
  { email: 'test_student@example.com', role: 'student', approvalStatus: 'approved', firstName: 'Test', lastName: 'Student', studentNumber: 'TEST-STUDENT-001' },
];
function fullName(u) { return (u.firstName + ' ' + u.lastName).trim(); }
async function findAuthUserByEmail(supabase, email) {
  let page = 1; const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('listUsers: ' + error.message);
    const users = data?.users || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1; if (page > 50) return null;
  }
}
async function upsertAuthUser(supabase, spec) {
  const existing = await findAuthUserByEmail(supabase, spec.email);
  const userMetadata = { first_name: spec.firstName, last_name: spec.lastName, full_name: fullName(spec), student_number: spec.studentNumber };
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, { password: PASSWORD, email: spec.email, email_confirm: true, user_metadata: { ...(existing.user_metadata || {}), ...userMetadata } });
    if (error) throw new Error('updateUser ' + spec.email + ': ' + error.message);
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser({ email: spec.email, password: PASSWORD, email_confirm: true, user_metadata: userMetadata });
  if (error) throw new Error('createUser ' + spec.email + ': ' + error.message);
  return data.user;
}
async function upsertProfile(client, user, spec) {
  const sql = "insert into public.profiles (id, email, first_name, last_name, student_number, full_name, role, approval_status) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do update set email=excluded.email, first_name=excluded.first_name, last_name=excluded.last_name, student_number=excluded.student_number, full_name=excluded.full_name, role=excluded.role, approval_status=excluded.approval_status, updated_at=now()";
  await client.query(sql, [user.id, spec.email, spec.firstName, spec.lastName, spec.studentNumber, fullName(spec), spec.role, spec.approvalStatus]);
}
async function main() {
  const supabase = getServiceClient();
  const client = new Client({ ...getPgConfig(), application_name: 'systems-create-test-users' });
  await client.connect();
  try {
    for (const spec of USERS) {
      const user = await upsertAuthUser(supabase, spec);
      await upsertProfile(client, user, spec);
      console.log('[test-users] ' + spec.email + ' (' + spec.role + ') ready. id=' + user.id);
    }
    console.log('[test-users] Done. Password for all: ' + PASSWORD);
  } finally { await client.end().catch(() => {}); }
}
main().catch((err) => { console.error('[test-users] Failed:', err.message); process.exitCode = 1; });
