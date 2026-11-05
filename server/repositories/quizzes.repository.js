// server/repositories/quizzes.repository.js
import { dbQuery, withTransaction } from '../db/pool.js';
import { mapAttempt, mapQuestion, mapQuiz } from '../utils/mappers.js';

export async function findQuizById(id) {
  const { rows } = await dbQuery(
    `select id, topic_id, title, mode, instructions, total_items, external_url,
            attachment_path, attachment_name, attachment_mime, max_attempts,
            show_answers, status, created_at, updated_at
       from public.quizzes where id = $1 limit 1`,
    [id],
  );
  return mapQuiz(rows[0]);
}

export async function findQuizByTopic(topicId) {
  const { rows } = await dbQuery(
    `select id, topic_id, title, mode, instructions, total_items, external_url,
            attachment_path, attachment_name, attachment_mime, max_attempts,
            show_answers, status, created_at, updated_at
       from public.quizzes where topic_id = $1 limit 1`,
    [topicId],
  );
  return mapQuiz(rows[0]);
}

export async function createQuiz(data) {
  const { rows } = await dbQuery(
    `insert into public.quizzes
       (topic_id, title, mode, instructions, total_items, external_url,
        attachment_path, attachment_name, attachment_mime, max_attempts,
        show_answers, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning id, topic_id, title, mode, instructions, total_items, external_url,
               attachment_path, attachment_name, attachment_mime, max_attempts,
               show_answers, status, created_at, updated_at`,
    [
      data.topicId,
      data.title,
      data.mode,
      data.instructions ?? null,
      data.totalItems ?? null,
      data.externalUrl ?? null,
      data.attachmentPath ?? null,
      data.attachmentName ?? null,
      data.attachmentMime ?? null,
      data.maxAttempts ?? null,
      data.showAnswers ?? false,
      data.status ?? 'draft',
    ],
  );
  return mapQuiz(rows[0]);
}

export async function updateQuiz(id, data) {
  const sets = [];
  const params = [id];
  let i = 2;
  const fieldMap = {
    title: 'title',
    mode: 'mode',
    instructions: 'instructions',
    totalItems: 'total_items',
    externalUrl: 'external_url',
    attachmentPath: 'attachment_path',
    attachmentName: 'attachment_name',
    attachmentMime: 'attachment_mime',
    maxAttempts: 'max_attempts',
    showAnswers: 'show_answers',
    status: 'status',
  };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      params.push(data[key]);
    }
  }
  if (sets.length === 0) return findQuizById(id);
  sets.push('updated_at = now()');
  const { rows } = await dbQuery(
    `update public.quizzes set ${sets.join(', ')} where id = $1
     returning id, topic_id, title, mode, instructions, total_items, external_url,
               attachment_path, attachment_name, attachment_mime, max_attempts,
               show_answers, status, created_at, updated_at`,
    params,
  );
  return mapQuiz(rows[0]);
}

export async function hasAttempts(quizId) {
  const { rows } = await dbQuery(
    `select 1 from public.attempts where quiz_id = $1 limit 1`,
    [quizId],
  );
  return rows.length > 0;
}

export async function deleteQuiz(id) {
  const { rows } = await dbQuery(`delete from public.quizzes where id = $1 returning id`, [id]);
  return rows[0] ? rows[0].id : null;
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function countQuestions(quizId) {
  const { rows } = await dbQuery(
    `select count(*)::int as c from public.questions where quiz_id = $1`,
    [quizId],
  );
  return rows[0]?.c || 0;
}

export async function listQuestionsByQuiz(quizId) {
  const { rows } = await dbQuery(
    `select id, quiz_id, position, type, prompt, options, correct_option_id,
            accepted_answers, points, created_at, updated_at
       from public.questions where quiz_id = $1 order by position asc`,
    [quizId],
  );
  return rows.map(mapQuestion);
}

export async function findQuestionById(id) {
  const { rows } = await dbQuery(
    `select id, quiz_id, position, type, prompt, options, correct_option_id,
            accepted_answers, points, created_at, updated_at
       from public.questions where id = $1 limit 1`,
    [id],
  );
  return mapQuestion(rows[0]);
}

export async function createQuestion(data) {
  const { rows } = await dbQuery(
    `insert into public.questions
       (quiz_id, position, type, prompt, options, correct_option_id,
        accepted_answers, points)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, quiz_id, position, type, prompt, options, correct_option_id,
               accepted_answers, points, created_at, updated_at`,
    [
      data.quizId,
      data.position,
      data.type,
      data.prompt,
      data.options ? JSON.stringify(data.options) : null,
      data.correctOptionId ?? null,
      data.acceptedAnswers ?? null,
      data.points ?? 1,
    ],
  );
  return mapQuestion(rows[0]);
}

export async function updateQuestion(id, data) {
  const sets = [];
  const params = [id];
  let i = 2;
  const fieldMap = {
    prompt: "prompt",
    options: "options",
    correctOptionId: "correct_option_id",
    acceptedAnswers: "accepted_answers",
    points: "points",
    position: "position",
  };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      if (key === "options") {
        params.push(data[key] === null ? null : JSON.stringify(data[key]));
      } else {
        params.push(data[key]);
      }
    }
  }
  if (sets.length === 0) return findQuestionById(id);
  sets.push("updated_at = now()");
  const { rows } = await dbQuery(
    `update public.questions set ${sets.join(", ")} where id = $1
     returning id, quiz_id, position, type, prompt, options, correct_option_id,
               accepted_answers, points, created_at, updated_at`,
    params,
  );
  return mapQuestion(rows[0]);
}

export async function deleteQuestion(id) {
  const { rows } = await dbQuery(
    `delete from public.questions where id = $1 returning id`,
    [id],
  );
  return rows[0] ? rows[0].id : null;
}

export async function reorderQuestions(quizId, questionIds) {
  return withTransaction(async (client) => {
    for (let i = 0; i < questionIds.length; i++) {
      await client.query(
        `update public.questions set position = $1 where id = $2 and quiz_id = $3`,
        [i + 1, questionIds[i], quizId],
      );
    }
    return true;
  });
}

export async function createQuestionsBulk(quizId, items) {
  return withTransaction(async (client) => {
    const results = [];
    const { rows: posRows } = await client.query(
      `select coalesce(max(position), 0) as max_pos from public.questions where quiz_id = $1`,
      [quizId],
    );
    let pos = posRows[0]?.max_pos || 0;
    for (const item of items) {
      pos += 1;
      const { rows } = await client.query(
        `insert into public.questions
           (quiz_id, position, type, prompt, options, correct_option_id,
            accepted_answers, points)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, quiz_id, position, type, prompt, options, correct_option_id,
                   accepted_answers, points, created_at, updated_at`,
        [
          quizId,
          pos,
          item.type,
          item.prompt,
          item.options ? JSON.stringify(item.options) : null,
          item.correctOptionId ?? null,
          item.acceptedAnswers ?? null,
          item.points ?? 1,
        ],
      );
      results.push(mapQuestion(rows[0]));
    }
    return results;
  });
}

export async function replaceQuestions(quizId, items) {
  return withTransaction(async (client) => {
    await client.query(`delete from public.questions where quiz_id = $1`, [quizId]);
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { rows } = await client.query(
        `insert into public.questions
           (quiz_id, position, type, prompt, options, correct_option_id,
            accepted_answers, points)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, quiz_id, position, type, prompt, options, correct_option_id,
                   accepted_answers, points, created_at, updated_at`,
        [
          quizId,
          i + 1,
          item.type,
          item.prompt,
          item.options ? JSON.stringify(item.options) : null,
          item.correctOptionId ?? null,
          item.acceptedAnswers ?? null,
          item.points ?? 1,
        ],
      );
      results.push(mapQuestion(rows[0]));
    }
    return results;
  });
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

export async function findAttemptById(id) {
  const { rows } = await dbQuery(
    `select id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
            image_path, feedback, graded_by, graded_at, started_at, submitted_at,
            created_at, updated_at
       from public.attempts where id = $1 limit 1`,
    [id],
  );
  return mapAttempt(rows[0]);
}

export async function findInProgressAttempt(quizId, studentId) {
  const { rows } = await dbQuery(
    `select id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
            image_path, feedback, graded_by, graded_at, started_at, submitted_at,
            created_at, updated_at
       from public.attempts
      where quiz_id = $1 and student_id = $2 and status = 'in_progress'
      order by started_at desc limit 1`,
    [quizId, studentId],
  );
  return mapAttempt(rows[0]);
}

export async function findPendingReviewAttempt(quizId, studentId) {
  const { rows } = await dbQuery(
    `select id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
            image_path, feedback, graded_by, graded_at, started_at, submitted_at,
            created_at, updated_at
       from public.attempts
      where quiz_id = $1 and student_id = $2 and status = 'pending_review'
      limit 1`,
    [quizId, studentId],
  );
  return mapAttempt(rows[0]);
}

export async function countAttempts(quizId, studentId) {
  const { rows } = await dbQuery(
    `select count(*)::int as c from public.attempts where quiz_id = $1 and student_id = $2`,
    [quizId, studentId],
  );
  return rows[0]?.c || 0;
}

export async function listAttemptsByStudentQuiz(quizId, studentId) {
  const { rows } = await dbQuery(
    `select id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
            image_path, feedback, graded_by, graded_at, started_at, submitted_at,
            created_at, updated_at
       from public.attempts where quiz_id = $1 and student_id = $2
      order by attempt_no asc`,
    [quizId, studentId],
  );
  return rows.map(mapAttempt);
}

export async function createAttempt(data) {
  const { rows } = await dbQuery(
    `insert into public.attempts
       (quiz_id, student_id, attempt_no, source, status, answers, image_path, submitted_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
               image_path, feedback, graded_by, graded_at, started_at, submitted_at,
               created_at, updated_at`,
    [
      data.quizId,
      data.studentId,
      data.attemptNo,
      data.source,
      data.status,
      data.answers ? JSON.stringify(data.answers) : null,
      data.imagePath ?? null,
      data.submittedAt ?? null,
    ],
  );
  return mapAttempt(rows[0]);
}

export async function updateAttempt(id, data) {
  const sets = [];
  const params = [id];
  let i = 2;
  const fieldMap = {
    status: "status",
    answers: "answers",
    score: "score",
    total: "total",
    imagePath: "image_path",
    submittedAt: "submitted_at",
    feedback: "feedback",
    gradedBy: "graded_by",
    gradedAt: "graded_at",
  };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      if (key === "answers") {
        params.push(data[key] === null ? null : JSON.stringify(data[key]));
      } else {
        params.push(data[key]);
      }
    }
  }
  if (sets.length === 0) return findAttemptById(id);
  sets.push("updated_at = now()");
  const { rows } = await dbQuery(
    `update public.attempts set ${sets.join(", ")} where id = $1
     returning id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
               image_path, feedback, graded_by, graded_at, started_at, submitted_at,
               created_at, updated_at`,
    params,
  );
  return mapAttempt(rows[0]);
}

export async function deleteAttempt(id) {
  const { rows } = await dbQuery(
    `delete from public.attempts where id = $1 returning id`,
    [id],
  );
  return rows[0] ? rows[0].id : null;
}

export async function listAllAttemptsByQuiz(quizId) {
  const { rows } = await dbQuery(
    `select id, quiz_id, student_id, attempt_no, source, status, answers, score, total,
            image_path, feedback, graded_by, graded_at, started_at, submitted_at,
            created_at, updated_at
       from public.attempts where quiz_id = $1`,
    [quizId],
  );
  return rows.map(mapAttempt);
}

export async function listSubmissionsBySubject(subjectId, { status, q } = {}) {
  let sql = `
    select a.id, a.quiz_id, a.student_id, a.attempt_no, a.source, a.status,
           a.score, a.total, a.image_path, a.feedback, a.graded_by, a.graded_at,
           a.started_at, a.submitted_at, a.created_at, a.updated_at,
           p.first_name, p.last_name, p.student_number, p.email,
           t.id as topic_id, t.title as topic_title,
           q.title as quiz_title, q.total_items
      from public.attempts a
      join public.quizzes q on q.id = a.quiz_id
      join public.topics t on t.id = q.topic_id
      join public.profiles p on p.id = a.student_id
     where t.subject_id = $1 and a.source = 'manual'
  `;
  const params = [subjectId];
  if (status) {
    params.push(status);
    sql += ` and a.status = $${params.length}`;
  }
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    sql += ` and (p.first_name ilike $${params.length} or p.last_name ilike $${params.length} or p.student_number ilike $${params.length})`;
  }
  sql += ` order by a.submitted_at desc nulls last, a.created_at desc`;
  const { rows } = await dbQuery(sql, params);
  return rows.map((r) => ({
    ...mapAttempt(r),
    student: {
      id: r.student_id,
      firstName: r.first_name,
      lastName: r.last_name,
      studentNumber: r.student_number,
      email: r.email,
    },
    topic: {
      id: r.topic_id,
      title: r.topic_title,
    },
    quiz: {
      id: r.quiz_id,
      title: r.quiz_title,
      totalItems: r.total_items,
    },
  }));
}

export async function findAttemptWithContext(attemptId) {
  const { rows } = await dbQuery(
    `select a.id, a.quiz_id, a.student_id, a.attempt_no, a.source, a.status,
            a.answers, a.score, a.total, a.image_path, a.feedback, a.graded_by,
            a.graded_at, a.started_at, a.submitted_at, a.created_at, a.updated_at,
            q.total_items, q.title as quiz_title, q.mode as quiz_mode,
            t.id as topic_id, t.title as topic_title,
            s.id as subject_id, s.faculty_id, s.passing_percent,
            p.first_name, p.last_name, p.student_number, p.email
       from public.attempts a
       join public.quizzes q on q.id = a.quiz_id
       join public.topics t on t.id = q.topic_id
       join public.subjects s on s.id = t.subject_id
       join public.profiles p on p.id = a.student_id
      where a.id = $1 limit 1`,
    [attemptId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    attempt: mapAttempt(r),
    quiz: { id: r.quiz_id, title: r.quiz_title, totalItems: r.total_items, mode: r.quiz_mode },
    topic: { id: r.topic_id, title: r.topic_title },
    subject: { id: r.subject_id, facultyId: r.faculty_id, passingPercent: r.passing_percent },
    student: { id: r.student_id, firstName: r.first_name, lastName: r.last_name, studentNumber: r.student_number, email: r.email },
  };
}
