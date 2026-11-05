// server/scripts/seed-lms.js
// Dev seed script for the LMS. Creates a small, self-contained dataset for
// manual QA and performance checks. Refuses to run when NODE_ENV=production.
// Usage: NODE_ENV=development node server/scripts/seed-lms.js
import pg from 'pg';
import crypto from 'node:crypto';
import { databaseConfigured, env } from '../config/env.js';
import { getPgConfig } from '../db/config.js';

const { Client } = pg;

if (env.nodeEnv === 'production') {
  console.error('[seed-lms] Refusing to run in NODE_ENV=production.');
  process.exit(1);
}

const client = new Client({
  ...getPgConfig(),
  application_name: 'systems-seed-lms',
});

// ---- Deterministic UUIDs so re-running is idempotent ----
const uuid = (seed) => {
  const hash = crypto.createHash('sha1').update(seed).digest();
  const bytes = [...hash];
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
};

const now = new Date();
const past = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const future = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

const facultyId = uuid('seed-lms-faculty-1');
const pendingFacultyId = uuid('seed-lms-faculty-2');
const studentIds = [
  uuid('seed-lms-student-01'),
  uuid('seed-lms-student-02'),
  uuid('seed-lms-student-03'),
  uuid('seed-lms-student-04'),
  uuid('seed-lms-student-05'),
  uuid('seed-lms-student-06'),
  uuid('seed-lms-student-07'),
  uuid('seed-lms-student-08'),
  uuid('seed-lms-student-09'),
  uuid('seed-lms-student-10'),
  uuid('seed-lms-student-11'),
  uuid('seed-lms-student-12'),
];

const subjectId = uuid('seed-lms-subject-1');

const topicIds = [
  uuid('seed-lms-topic-1'),
  uuid('seed-lms-topic-2'),
  uuid('seed-lms-topic-3'),
  uuid('seed-lms-topic-4'),
  uuid('seed-lms-topic-5'),
  uuid('seed-lms-topic-6'),
  uuid('seed-lms-topic-7'),
  uuid('seed-lms-topic-8'),
];

const builtQuizId = uuid('seed-lms-quiz-built-1');
const uploadedQuizId = uuid('seed-lms-quiz-uploaded-1');

async function main() {
  if (!databaseConfigured) {
    console.error('DATABASE_URL is missing or still contains a placeholder.');
    process.exit(1);
  }

  await client.connect();
  await client.query('SET row_security = off');
  await client.query('BEGIN');

  try {
    // ---- 0. Auth users (required by profiles FK) ----
  const authUserIds = [facultyId, pendingFacultyId, ...studentIds];
  const authEmails = ['faculty.approved@example.com', 'faculty.pending@example.com',
    'ana.nunez@example.com', 'benito.ojeda@example.com', 'clarisse.ibanez@example.com',
    'diego.reyes@example.com', 'elena.cruz@example.com', 'francis.tan@example.com',
    'grace.lim@example.com', 'hector.morales@example.com', 'isabel.santos@example.com',
    'julian.garcia@example.com', 'kristine.aquino@example.com', 'luis.martinez@example.com'];
  for (let i = 0; i < authUserIds.length; i++) {
    await client.query(
      `insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
       values ($1, $2, '$2a$10$l3hyYk4eM6oV2N1.UK0iV.3UChX1J6LuorT8jdCWpmE6lw3JLwOI2', now(), now(), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{}', false, false)
       on conflict (id) do nothing`,
      [authUserIds[i], authEmails[i]],
    );
  }

  // ---- 1. Profiles ----
    await client.query(
      `insert into public.profiles
        (id, email, full_name, first_name, last_name, student_number, approval_status, role)
      values
        ($1, 'faculty.approved@example.com', 'Maria Dela Cruz', 'Maria', 'Dela Cruz', NULL, 'approved', 'faculty'),
        ($2, 'faculty.pending@example.com', 'Jose R. Santos', 'Jose', 'Santos', NULL, 'pending', 'faculty')
      on conflict (id) do update
        set email = excluded.email,
            full_name = excluded.full_name,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            approval_status = excluded.approval_status,
            role = excluded.role`,
      [facultyId, pendingFacultyId],
    );

    const students = [
      { id: studentIds[0], email: 'ana.nunez@example.com', first: 'Ana', last: 'Nuñez', sn: 'TUPT-23-0001' },
      { id: studentIds[1], email: 'benito.ojeda@example.com', first: 'Benito', last: 'Ojeda', sn: 'TUPT-23-0002' },
      { id: studentIds[2], email: 'clarisse.ibanez@example.com', first: 'Clarisse', last: 'Ibañez', sn: 'TUPT-23-0003' },
      { id: studentIds[3], email: 'dylan.reyes@example.com', first: 'Dylan', last: 'Reyes', sn: 'TUPT-23-0004' },
      { id: studentIds[4], email: 'elena.castro@example.com', first: 'Elena', last: 'Castro', sn: 'TUPT-23-0005' },
      { id: studentIds[5], email: 'felix.velasco@example.com', first: 'Felix', last: 'Velasco', sn: 'TUPT-23-0006' },
      { id: studentIds[6], email: 'grace.mendoza-example@example.com', first: 'Grace', last: 'Mendoza-Example', sn: 'TUPT-23-0007' },
      { id: studentIds[7], email: 'hugo.ibanez@example.com', first: 'Hugo', last: 'Ibáñez', sn: 'TUPT-23-0008' },
      { id: studentIds[8], email: 'irene.o-neill@example.com', first: 'Irene', last: "O'Neill", sn: 'TUPT-23-0009' },
      { id: studentIds[9], email: 'juan.dela-cruz@example.com', first: 'Juan', last: 'Dela-Cruz', sn: 'TUPT-23-0010' },
      { id: studentIds[10], email: 'karen.yglesias@example.com', first: 'Karen', last: 'Yglesias', sn: 'TUPT-23-0011' },
      { id: studentIds[11], email: 'luis.munoz-example@example.com', first: 'Luis', last: 'Muñoz-Example', sn: 'TUPT-23-0012' },
    ];

    for (const s of students) {
      await client.query(
        `insert into public.profiles
          (id, email, full_name, first_name, last_name, student_number, approval_status, role)
        values ($1, $2, $3, $4, $5, $6, 'approved', 'student')
        on conflict (id) do update
          set email = excluded.email,
              full_name = excluded.full_name,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              student_number = excluded.student_number`,
        [s.id, s.email, `${s.first} ${s.last}`, s.first, s.last, s.sn],
      );
    }

    // ---- 3. Subject ----
    await client.query(
      `insert into public.subjects
        (id, faculty_id, code, name, description, term, school_year, join_code,
         enrollment_open, passing_percent, timezone, status)
       values ($1, $2, 'IT101', 'Introduction to Technology',
               'Foundation course for IT students.', '1st Semester', '2026-2027',
               'A1B2C3D4', true, 75, 'Asia/Manila', 'active')
       on conflict (id) do update
         set name = excluded.name`,
      [subjectId, facultyId],
    );

    // ---- 2. Enrollments ----
    for (const s of students) {
      await client.query(
        `insert into public.enrollments (subject_id, student_id, status)
         values ($1, $2, 'active')
         on conflict (subject_id, student_id) do nothing`,
        [subjectId, s.id],
      );
    }

    // ---- 4. Topics (8, mixed past/future dates) ----
    const topics = [
      { id: topicIds[0], position: 1, title: 'Welcome to IT101', availableFrom: past(30), status: 'published' },
      { id: topicIds[1], position: 2, title: 'Number Systems', availableFrom: past(20), status: 'published' },
      { id: topicIds[2], position: 3, title: 'Logic Gates', availableFrom: past(10), status: 'published' },
      { id: topicIds[3], position: 4, title: 'Boolean Algebra', availableFrom: past(5), status: 'published' },
      { id: topicIds[4], position: 5, title: 'Combinational Circuits', availableFrom: past(2), status: 'published' },
      { id: topicIds[5], position: 6, title: 'Sequential Circuits', availableFrom: future(3), status: 'published' },
      { id: topicIds[6], position: 7, title: 'Computer Architecture', availableFrom: future(10), status: 'draft' },
      { id: topicIds[7], position: 8, title: 'Final Project', availableFrom: future(20), status: 'draft' },
    ];

    for (const t of topics) {
      await client.query(
        `insert into public.topics
          (id, subject_id, position, title, description, available_from, status)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update
           set title = excluded.title, available_from = excluded.available_from, status = excluded.status`,
        [t.id, subjectId, t.position, t.title, t.description || '', t.availableFrom, t.status],
      );
    }

    // ---- 5. Built quiz on topic 3 (Logic Gates) ----
    await client.query(
      `insert into public.quizzes
        (id, topic_id, title, mode, instructions, total_items, external_url,
         attachment_path, attachment_name, attachment_mime, max_attempts,
         show_answers, status)
       values ($1, $2, 'Logic Gates Quiz', 'built', 'Answer all questions.', NULL, NULL,
               NULL, NULL, NULL, 3, false, 'published')
       on conflict (id) do update
         set title = excluded.title, status = excluded.status`,
      [builtQuizId, topicIds[2]],
    );

    const questions = [
      // Choice questions
      { position: 1, type: 'choice', prompt: 'What is 2 AND 0?', options: '[{"id":"a","label":"0"},{"id":"b","label":"1"}]', correct: 'a', answers: null, points: 1 },
      { position: 2, type: 'choice', prompt: 'What is 1 OR 0?', options: '[{"id":"a","label":"0"},{"id":"b","label":"1"}]', correct: 'b', answers: null, points: 1 },
      { position: 3, type: 'choice', prompt: 'What is NOT 1?', options: '[{"id":"a","label":"0"},{"id":"b","label":"1"}]', correct: 'a', answers: null, points: 1 },
      { position: 4, type: 'choice', prompt: 'What is 1 XOR 1?', options: '[{"id":"a","label":"0"},{"id":"b","label":"1"}]', correct: 'a', answers: null, points: 1 },
      { position: 5, type: 'choice', prompt: 'What is 0 XOR 1?', options: '[{"id":"a","label":"0"},{"id":"b","label":"1"}]', correct: 'b', answers: null, points: 1 },
      { position: 6, type: 'choice', prompt: 'What is 1 AND 1?', options: '[{"id":"a","label":"0"},{"id":"b","label":"1"}]', correct: 'b', answers: null, points: 1 },
      // Text questions
      { position: 7, type: 'text', prompt: 'Name one basic logic gate.', options: null, correct: null, answers: '{"AND","OR","NOT","NAND","NOR","XOR","XNOR"}', points: 1 },
      { position: 8, type: 'text', prompt: 'What does NAND stand for?', options: null, correct: null, answers: '{"Not AND","NOT AND"}', points: 1 },
      { position: 9, type: 'text', prompt: 'How many inputs does a basic gate have?', options: null, correct: null, answers: '{"2","two"}', points: 1 },
      { position: 10, type: 'text', prompt: 'Name a universal gate.', options: null, correct: null, answers: '{"NAND","NOR"}', points: 1 },
      { position: 11, type: 'text', prompt: 'What is the output of NOT 0?', options: null, correct: null, answers: '{"1","one"}', points: 1 },
      { position: 12, type: 'text', prompt: 'What is a truth table?', options: null, correct: null, answers: '{"A table showing all possible input combinations and their outputs"}', points: 1 },
    ];

    for (const q of questions) {
      await client.query(
        `insert into public.questions
          (id, quiz_id, position, type, prompt, options, correct_option_id, accepted_answers, points)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do nothing`,
        [uuid(`seed-lms-question-${q.position}`), builtQuizId, q.position, q.type, q.prompt,
         q.options, q.correct, q.answers, q.points],
      );
    }

    // ---- 6. Uploaded quiz on topic 4 (Boolean Algebra) ----
    await client.query(
      `insert into public.quizzes
        (id, topic_id, title, mode, instructions, total_items, external_url,
         attachment_path, attachment_name, attachment_mime, max_attempts,
         show_answers, status)
       values ($1, $2, 'Boolean Algebra Uploaded Quiz', 'uploaded', 'Upload a photo of your score sheet.',
               20, 'https://example.com/form', NULL, NULL, NULL, 2, false, 'published')
       on conflict (id) do update
         set title = excluded.title, status = excluded.status`,
      [uploadedQuizId, topicIds[3]],
    );

    // ---- 7. Sample attempts ----
    // Student 1: passed built quiz (8/12)
    await client.query(
      `insert into public.attempts
        (id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
         image_path, feedback, graded_by, graded_at, started_at, submitted_at)
       values ($1, $2, $3, 1, 'auto', 'graded', '[]', 8, 12, NULL, NULL, $4, $5, $6, $7)
       on conflict (quiz_id, student_id, attempt_no) do nothing`,
      [uuid('seed-lms-attempt-1'), builtQuizId, studentIds[0], facultyId, past(3), past(3), past(3)],
    );

    // Student 2: failed built quiz (5/12)
    await client.query(
      `insert into public.attempts
        (id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
         image_path, feedback, graded_by, graded_at, started_at, submitted_at)
       values ($1, $2, $3, 1, 'auto', 'graded', '[]', 5, 12, NULL, NULL, $4, $5, $6, $7)
       on conflict (quiz_id, student_id, attempt_no) do nothing`,
      [uuid('seed-lms-attempt-2'), builtQuizId, studentIds[1], facultyId, past(2), past(2), past(2)],
    );

    // Student 3: pending uploaded quiz
    await client.query(
      `insert into public.attempts
        (id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
         image_path, feedback, graded_by, graded_at, started_at, submitted_at)
       values ($1, $2, $3, 1, 'manual', 'pending_review', NULL, NULL, NULL,
               'subjects/.../quizzes/.../student3/abc.png', NULL, NULL, NULL,
               $4, $5)
       on conflict (quiz_id, student_id, attempt_no) do nothing`,
      [uuid('seed-lms-attempt-3'), uploadedQuizId, studentIds[2], past(1), past(1)],
    );

    await client.query('COMMIT');

    console.log('[seed-lms] Done:');
    console.log(`  profiles: 14 (1 faculty approved, 1 faculty pending, 12 students)`);
    console.log(`  enrollments: ${students.length}`);
    console.log(`  subjects: 1 (IT101)`);
    console.log(`  topics: 8 (5 published past, 1 published future, 2 draft)`);
    console.log(`  quizzes: 2 (1 built, 1 uploaded)`);
    console.log(`  questions: 12`);
    console.log(`  attempts: 3 (1 passed, 1 failed, 1 pending)`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[seed-lms] Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[seed-lms] Failed:', error.message);
  process.exitCode = 1;
});
