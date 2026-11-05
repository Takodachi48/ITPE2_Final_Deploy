// server/repositories/subjects.repository.js
import { dbQuery } from '../db/pool.js';
import { mapSubject, mapEnrollment } from '../utils/mappers.js';

export async function findSubjectById(id) {
  const { rows } = await dbQuery(
    `select id, faculty_id, code, name, description, term, school_year,
            join_code, passing_percent, enrollment_open, status, timezone,
            start_date, meeting_day,
            created_at, updated_at
       from public.subjects
      where id = $1
      limit 1`,
    [id],
  );
  return mapSubject(rows[0]);
}

export async function findSubjectByJoinCode(joinCode) {
  const { rows } = await dbQuery(
    `select id, faculty_id, code, name, description, term, school_year,
            join_code, passing_percent, enrollment_open, status, timezone,
            start_date, meeting_day,
            created_at, updated_at
       from public.subjects
      where join_code = $1
      limit 1`,
    [joinCode],
  );
  return mapSubject(rows[0]);
}

export async function listSubjectsByFaculty(facultyId, status) {
  const params = [facultyId];
  let where = 'where s.faculty_id = $1';
  if (status) {
    params.push(status);
    where += ` and s.status = $${params.length}`;
  }
  const { rows } = await dbQuery(
    `select s.id, s.faculty_id, s.code, s.name, s.description, s.term, s.school_year,
            s.join_code, s.passing_percent, s.enrollment_open, s.status, s.timezone,
            s.start_date, s.meeting_day, s.created_at, s.updated_at,
            count(e.id) filter (where e.status = 'active')::int as student_count
       from public.subjects s
       left join public.enrollments e on e.subject_id = s.id
       ${where}
     group by s.id
     order by s.created_at desc`,
    params,
  );
  return rows.map(mapSubject);
}

export async function listAllSubjects(status) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `where s.status = $${params.length}`;
  }
  const { rows } = await dbQuery(
    `select s.id, s.faculty_id, s.code, s.name, s.description, s.term, s.school_year,
            s.join_code, s.passing_percent, s.enrollment_open, s.status, s.timezone,
            s.start_date, s.meeting_day, s.created_at, s.updated_at,
            count(e.id) filter (where e.status = 'active')::int as student_count
       from public.subjects s
       left join public.enrollments e on e.subject_id = s.id
       ${where}
     group by s.id
     order by s.created_at desc`,
    params,
  );
  return rows.map(mapSubject);
}

export async function createSubject(data) {
  const { rows } = await dbQuery(
    `insert into public.subjects
       (faculty_id, code, name, description, term, school_year, join_code,
        passing_percent, enrollment_open, status, timezone, start_date, meeting_day)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning id, faculty_id, code, name, description, term, school_year,
               join_code, passing_percent, enrollment_open, status, timezone,
               start_date, meeting_day,
               created_at, updated_at`,
    [
      data.facultyId,
      data.code,
      data.name,
      data.description ?? null,
      data.term,
      data.schoolYear,
      data.joinCode,
      data.passingPercent ?? 75,
      data.enrollmentOpen ?? true,
      data.status ?? 'active',
      data.timezone ?? 'Asia/Manila',
      data.startDate ?? null,
      data.meetingDay ?? null,
    ],
  );
  return mapSubject(rows[0]);
}

export async function updateSubject(id, data) {
  const sets = [];
  const params = [id];
  let i = 2;

  const fieldMap = {
    name: 'name',
    description: 'description',
    term: 'term',
    schoolYear: 'school_year',
    passingPercent: 'passing_percent',
    enrollmentOpen: 'enrollment_open',
    status: 'status',
    timezone: 'timezone',
    code: 'code',
    joinCode: 'join_code',
    startDate: 'start_date',
    meetingDay: 'meeting_day',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      params.push(data[key]);
    }
  }

  if (sets.length === 0) return findSubjectById(id);

  sets.push('updated_at = now()');

  const { rows } = await dbQuery(
    `update public.subjects
        set ${sets.join(', ')}
      where id = $1
      returning id, faculty_id, code, name, description, term, school_year,
                join_code, passing_percent, enrollment_open, status, timezone,
                start_date, meeting_day,
                created_at, updated_at`,
    params,
  );
  return mapSubject(rows[0]);
}

export async function countStudents(subjectId) {
  const { rows } = await dbQuery(
    `select count(*)::int as count
       from public.enrollments
      where subject_id = $1 and status = 'active'`,
    [subjectId],
  );
  return rows[0]?.count || 0;
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

export async function findEnrollment(subjectId, studentId) {
  const { rows } = await dbQuery(
    `select id, subject_id, student_id, status, enrolled_at, removed_at,
            created_at, updated_at
       from public.enrollments
      where subject_id = $1 and student_id = $2
      limit 1`,
    [subjectId, studentId],
  );
  return rows[0] ? mapEnrollment(rows[0]) : null;
}

export async function createEnrollment(subjectId, studentId) {
  const { rows } = await dbQuery(
    `insert into public.enrollments (subject_id, student_id, status)
     values ($1, $2, 'active')
     on conflict (subject_id, student_id) do update
       set status = 'active',
           removed_at = null,
           updated_at = now()
     returning id, subject_id, student_id, status, enrolled_at, removed_at,
               created_at, updated_at`,
    [subjectId, studentId],
  );
  return mapEnrollment(rows[0]);
}

export async function removeEnrollment(subjectId, studentId) {
  const { rows } = await dbQuery(
    `update public.enrollments
        set status = 'removed',
            removed_at = now(),
            updated_at = now()
      where subject_id = $1 and student_id = $2
      returning id, subject_id, student_id, status, enrolled_at, removed_at,
                created_at, updated_at`,
    [subjectId, studentId],
  );
  return rows[0] ? mapEnrollment(rows[0]) : null;
}

export async function listEnrollmentsBySubject(subjectId) {
  const { rows } = await dbQuery(
    `select e.id, e.subject_id, e.student_id, e.status, e.enrolled_at,
            e.removed_at, e.created_at, e.updated_at,
            p.first_name, p.last_name, p.student_number, p.email
       from public.enrollments e
       join public.profiles p on p.id = e.student_id
      where e.subject_id = $1
     order by p.last_name, p.first_name`,
    [subjectId],
  );
  return rows.map((row) => ({
    ...mapEnrollment(row),
    student: {
      id: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      studentNumber: row.student_number,
      email: row.email,
    },
  }));
}

export async function listSubjectsByStudent(studentId) {
  const { rows } = await dbQuery(
    `select s.id, s.faculty_id, s.code, s.name, s.description, s.term,
            s.school_year, s.join_code, s.passing_percent, s.enrollment_open,
            s.status, s.timezone, s.start_date, s.meeting_day, s.created_at, s.updated_at,
            p.first_name as faculty_first, p.last_name as faculty_last,
            (select count(*)::int from public.enrollments e2 where e2.subject_id = s.id and e2.status = 'active') as student_count
       from public.subjects s
       join public.enrollments e on e.subject_id = s.id
       left join public.profiles p on p.id = s.faculty_id
      where e.student_id = $1 and e.status = 'active' and s.status = 'active'
     order by s.created_at desc`,
    [studentId],
  );
  return rows.map((row) => ({
    ...mapSubject(row),
    facultyName: row.faculty_last
      ? `${row.faculty_last}, ${row.faculty_first}`
      : null,
  }));
}