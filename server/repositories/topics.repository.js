// server/repositories/topics.repository.js
import { dbQuery, withTransaction } from '../db/pool.js';
import { mapTopic } from '../utils/mappers.js';

export async function findTopicById(id) {
  const { rows } = await dbQuery(
    `select id, subject_id, position, title, description, available_from,
            status, created_at, updated_at
       from public.topics
      where id = $1
      limit 1`,
    [id],
  );
  return mapTopic(rows[0]);
}

export async function listTopicsBySubject(subjectId) {
  const { rows } = await dbQuery(
    `select id, subject_id, position, title, description, available_from,
            status, created_at, updated_at
       from public.topics
      where subject_id = $1
     order by position asc`,
    [subjectId],
  );
  return rows.map(mapTopic);
}

export async function createTopic(data) {
  const { rows } = await dbQuery(
    `insert into public.topics (subject_id, position, title, description, available_from, status)
     values ($1, $2, $3, $4, $5, $6)
     returning id, subject_id, position, title, description, available_from,
               status, created_at, updated_at`,
    [
      data.subjectId,
      data.position,
      data.title,
      data.description ?? null,
      data.availableFrom,
      data.status ?? 'draft',
    ],
  );
  return mapTopic(rows[0]);
}

export async function updateTopic(id, data) {
  const sets = [];
  const params = [id];
  let i = 2;

  const fieldMap = {
    title: 'title',
    description: 'description',
    availableFrom: 'available_from',
    status: 'status',
    position: 'position',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      params.push(data[key]);
    }
  }

  if (sets.length === 0) return findTopicById(id);

  sets.push('updated_at = now()');

  const { rows } = await dbQuery(
    `update public.topics
        set ${sets.join(', ')}
      where id = $1
      returning id, subject_id, position, title, description, available_from,
                status, created_at, updated_at`,
    params,
  );
  return mapTopic(rows[0]);
}

export async function deleteTopic(id) {
  const { rows } = await dbQuery(
    `delete from public.topics where id = $1 returning id`,
    [id],
  );
  return rows[0] ? rows[0].id : null;
}

export async function getMaxPosition(subjectId) {
  const { rows } = await dbQuery(
    `select coalesce(max(position), 0) as max_pos
       from public.topics
      where subject_id = $1`,
    [subjectId],
  );
  return rows[0]?.max_pos || 0;
}

export async function reorderTopics(subjectId, topicIds) {
  return withTransaction(async (client) => {
    // Verify all topicIds belong to this subject
    const { rows: existing } = await client.query(
      `select id from public.topics where subject_id = $1`,
      [subjectId],
    );
    const existingIds = new Set(existing.map((r) => r.id));
    if (topicIds.length !== existingIds.size) {
      throw new Error('Topic list must include exactly all subject topics.');
    }
    for (const id of topicIds) {
      if (!existingIds.has(id)) {
        throw new Error('Topic list must include exactly all subject topics.');
      }
    }

    // Update positions using deferred constraint
    for (let i = 0; i < topicIds.length; i++) {
      await client.query(
        `update public.topics set position = $1 where id = $2`,
        [i + 1, topicIds[i]],
      );
    }

    return true;
  });
}

export async function hasAttempts(topicId) {
  // Stub: will be implemented in Phase 04 when attempts table exists.
  // For now, check if any topic_progress exists.
  const { rows } = await dbQuery(
    `select 1 from public.topic_progress where topic_id = $1 limit 1`,
    [topicId],
  );
  return rows.length > 0;
}

export async function createTopicsBulk(topics) {
  return withTransaction(async (client) => {
    const results = [];
    for (const t of topics) {
      const { rows } = await client.query(
        `insert into public.topics (subject_id, position, title, description, available_from, status)
         values ($1, $2, $3, $4, $5, $6)
         returning id, subject_id, position, title, description, available_from,
                   status, created_at, updated_at`,
        [t.subjectId, t.position, t.title, t.description, t.availableFrom, t.status || 'draft'],
      );
      results.push(mapTopic(rows[0]));
    }
    return results;
  });
}

export async function recordTopicProgress(studentId, topicId) {
  const { rows } = await dbQuery(
    `insert into public.topic_progress (student_id, topic_id)
     values ($1, $2)
     on conflict (student_id, topic_id) do nothing
     returning student_id, topic_id`,
    [studentId, topicId],
  );
  return rows[0] || null;
}