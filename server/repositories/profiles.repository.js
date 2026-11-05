import { dbQuery } from '../db/pool.js';
import { mapProfile } from '../utils/mappers.js';

export async function findProfileById(id) {
  const { rows } = await dbQuery(
    `select id, email, full_name, first_name, last_name, student_number,
            approval_status, role, created_at, updated_at
       from public.profiles
      where id = $1
      limit 1`,
    [id],
  );

  return mapProfile(rows[0]);
}

export async function ensureProfile(user) {
  const existing = await findProfileById(user.id);
  if (existing) return existing;

  const email = user.email || null;
  const fullName = user.user_metadata?.full_name || null;

  const { rows } = await dbQuery(
    `insert into public.profiles (id, email, full_name, first_name, last_name, student_number)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update
       set email = coalesce(excluded.email, public.profiles.email),
           updated_at = now()
     returning id, email, full_name, first_name, last_name, student_number,
               approval_status, role, created_at, updated_at`,
    [
      user.id,
      email,
      fullName,
      user.user_metadata?.first_name || null,
      user.user_metadata?.last_name || null,
      user.user_metadata?.student_number || null,
    ],
  );

  return mapProfile(rows[0]);
}

export async function listProfiles(filters = {}) {
  const { approvalStatus, role } = filters;
  const conditions = [];
  const params = [];

  if (approvalStatus) {
    params.push(approvalStatus);
    conditions.push(`p.approval_status = $${params.length}`);
  }
  if (role) {
    params.push(role);
    conditions.push(`p.role = $${params.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

  const { rows } = await dbQuery(`
    select p.id,
           p.email,
           p.full_name,
           p.first_name,
           p.last_name,
           p.student_number,
           p.approval_status,
           p.role,
           p.created_at,
           p.updated_at,
           u.last_sign_in_at
      from public.profiles p
      left join auth.users u on u.id = p.id
      ${where}
     order by p.created_at asc
  `, params);

  return rows.map((row) => ({
    ...mapProfile(row),
    lastSignInAt: row.last_sign_in_at,
  }));
}

export async function findProfileByStudentNumber(studentNumber) {
  if (!studentNumber) return null;
  const { rows } = await dbQuery(
    `select id, email, full_name, first_name, last_name, student_number,
            approval_status, role, created_at, updated_at
       from public.profiles
      where lower(student_number) = lower($1)
      limit 1`,
    [studentNumber],
  );
  return mapProfile(rows[0]);
}

export async function updateProfile(id, updates) {
  const sets = [];
  const params = [id];
  let i = 2;

  if (updates.role !== undefined) {
    sets.push(`role = $${i++}`);
    params.push(updates.role);
  }
  if (updates.approvalStatus !== undefined) {
    sets.push(`approval_status = $${i++}`);
    params.push(updates.approvalStatus);
  }
  if (updates.fullName !== undefined) {
    sets.push(`full_name = $${i++}`);
    params.push(updates.fullName);
  }
  if (updates.firstName !== undefined) {
    sets.push(`first_name = $${i++}`);
    params.push(updates.firstName);
  }
  if (updates.lastName !== undefined) {
    sets.push(`last_name = $${i++}`);
    params.push(updates.lastName);
  }
  if (updates.studentNumber !== undefined) {
    sets.push(`student_number = $${i++}`);
    params.push(updates.studentNumber);
  }

  sets.push('updated_at = now()');

  const { rows } = await dbQuery(
    `update public.profiles
        set ${sets.join(', ')}
      where id = $1
      returning id, email, full_name, first_name, last_name, student_number,
                approval_status, role, created_at, updated_at`,
    params,
  );
  return mapProfile(rows[0]);
}

export async function countAdmins() {
  const { rows } = await dbQuery(
    `select count(*)::int as count
       from public.profiles
      where role = 'admin'`,
  );

  return rows[0]?.count || 0;
}
