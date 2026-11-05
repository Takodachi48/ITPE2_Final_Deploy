// server/repositories/content-blocks.repository.js
import { dbQuery, withTransaction } from '../db/pool.js';
import { mapContentBlock } from '../utils/mappers.js';

export async function findContentBlockById(id) {
  const { rows } = await dbQuery(
    `select id, topic_id, type, title, body, url, file_path, file_name,
            file_mime, file_size, visible_to_students, position,
            created_at, updated_at
       from public.topic_content
      where id = $1
      limit 1`,
    [id],
  );
  return mapContentBlock(rows[0]);
}

export async function listContentBlocksByTopic(topicId) {
  const { rows } = await dbQuery(
    `select id, topic_id, type, title, body, url, file_path, file_name,
            file_mime, file_size, visible_to_students, position,
            created_at, updated_at
       from public.topic_content
      where topic_id = $1
     order by position asc`,
    [topicId],
  );
  return rows.map(mapContentBlock);
}

export async function createContentBlock(data) {
  const { rows } = await dbQuery(
    `insert into public.topic_content
       (topic_id, type, title, body, url, file_path, file_name, file_mime,
        file_size, visible_to_students, position)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id, topic_id, type, title, body, url, file_path, file_name,
               file_mime, file_size, visible_to_students, position,
               created_at, updated_at`,
    [
      data.topicId,
      data.type,
      data.title ?? null,
      data.body ?? null,
      data.url ?? null,
      data.filePath ?? null,
      data.fileName ?? null,
      data.fileMime ?? null,
      data.fileSize ?? null,
      data.visibleToStudents ?? true,
      data.position ?? 1,
    ],
  );
  return mapContentBlock(rows[0]);
}

export async function updateContentBlock(id, data) {
  const sets = [];
  const params = [id];
  let i = 2;

  const fieldMap = {
    title: 'title',
    body: 'body',
    url: 'url',
    filePath: 'file_path',
    fileName: 'file_name',
    fileMime: 'file_mime',
    fileSize: 'file_size',
    visibleToStudents: 'visible_to_students',
    position: 'position',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      params.push(data[key]);
    }
  }

  if (sets.length === 0) return findContentBlockById(id);

  sets.push('updated_at = now()');

  const { rows } = await dbQuery(
    `update public.topic_content
        set ${sets.join(', ')}
      where id = $1
      returning id, topic_id, type, title, body, url, file_path, file_name,
                file_mime, file_size, visible_to_students, position,
                created_at, updated_at`,
    params,
  );
  return mapContentBlock(rows[0]);
}

export async function deleteContentBlock(id) {
  const { rows } = await dbQuery(
    `delete from public.topic_content where id = $1 returning id, file_path`,
    [id],
  );
  return rows[0] || null;
}

export async function reorderContentBlocks(topicId, blockIds) {
  return withTransaction(async (client) => {
    for (let i = 0; i < blockIds.length; i++) {
      await client.query(
        `update public.topic_content set position = $1 where id = $2 and topic_id = $3`,
        [i + 1, blockIds[i], topicId],
      );
    }
    return true;
  });
}

export async function getNextPosition(topicId) {
  const { rows } = await dbQuery(
    `select coalesce(max(position), 0) + 1 as next_pos
       from public.topic_content
      where topic_id = $1`,
    [topicId],
  );
  return rows[0]?.next_pos || 1;
}