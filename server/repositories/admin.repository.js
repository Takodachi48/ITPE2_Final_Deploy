import { dbQuery } from '../db/pool.js';
import { mapPresenter } from '../utils/mappers.js';

export async function nextModuleId(client) {
  const { rows } = await client.query(
    `select coalesce(max(id), 0) + 1 as id from public.modules`,
  );

  return rows[0].id;
}

export async function lockModule(client, id) {
  const { rows } = await client.query(
    `select *
       from public.modules
      where id = $1
      for update`,
    [id],
  );

  return rows[0] || null;
}

export async function themeExists(client, themeId) {
  const { rows } = await client.query(
    `select 1 from public.themes where id = $1 limit 1`,
    [themeId],
  );

  return Boolean(rows.length);
}

export async function findPresenterIds(client, ids) {
  if (!ids.length) return [];

  const { rows } = await client.query(
    `select id from public.presenters where id = any($1::uuid[])`,
    [ids],
  );

  return rows.map((row) => row.id);
}

export async function insertModule(client, module) {
  const { rows } = await client.query(
    `insert into public.modules
       (id, slug, title, description, summary, ppt_url, status, theme_id, published_at)
     values ($1, $2, $3, $4, $5, $6, $7::public.module_status, $8, $9)
     returning *`,
    [
      module.id,
      module.slug,
      module.title,
      module.description,
      module.summary,
      module.pptUrl,
      module.status,
      module.themeId,
      module.status === 'published' ? new Date() : null,
    ],
  );

  return rows[0];
}

const MODULE_COLUMNS = {
  slug: 'slug',
  title: 'title',
  description: 'description',
  summary: 'summary',
  pptUrl: 'ppt_url',
  status: 'status',
  themeId: 'theme_id',
  publishedAt: 'published_at',
};

export async function updateModuleRow(client, id, updates) {
  const fields = [];
  const params = [];

  for (const [key, column] of Object.entries(MODULE_COLUMNS)) {
    if (updates[key] === undefined) continue;
    params.push(updates[key]);
    fields.push(`${column} = $${params.length}`);
  }

  if (!fields.length) return null;

  fields.push('updated_at = now()');
  params.push(id);

  const { rows } = await client.query(
    `update public.modules
        set ${fields.join(', ')}
      where id = $${params.length}
      returning *`,
    params,
  );

  return rows[0] || null;
}

export async function archiveModuleRow(client, id) {
  const { rows } = await client.query(
    `update public.modules
        set status = 'archived',
            updated_at = now()
      where id = $1
      returning *`,
    [id],
  );

  return rows[0] || null;
}

export async function deleteModuleRow(client, id) {
  const { rows } = await client.query(
    `delete from public.modules where id = $1 returning id`,
    [id],
  );

  return rows[0] || null;
}

export async function replaceVideos(client, moduleId, videos) {
  await client.query(`delete from public.module_videos where module_id = $1`, [
    moduleId,
  ]);

  const rows = [];

  for (const [index, video] of videos.entries()) {
    const { rows: inserted } = await client.query(
      `insert into public.module_videos (module_id, url, label, position)
       values ($1, $2, $3, $4)
       returning id, url, label, position`,
      [moduleId, video.url, video.label || null, index],
    );

    rows.push(inserted[0]);
  }

  return rows;
}

export async function countModulePresenters(client, moduleId) {
  const { rows } = await client.query(
    `select count(*)::int as count
       from public.module_presenters
      where module_id = $1`,
    [moduleId],
  );

  return rows[0]?.count || 0;
}

export async function replacePresenters(client, moduleId, presenterIds) {
  await client.query(
    `delete from public.module_presenters where module_id = $1`,
    [moduleId],
  );

  for (const [index, presenterId] of presenterIds.entries()) {
    await client.query(
      `insert into public.module_presenters
         (module_id, presenter_id, role, position)
       values ($1, $2, 'Presenter', $3)`,
      [moduleId, presenterId, index],
    );
  }
}

export async function addVideo(moduleId, video) {
  const { rows } = await dbQuery(
    `insert into public.module_videos (module_id, url, label, position)
     values (
       $1,
       $2,
       $3,
       (select coalesce(max(position), -1) + 1
          from public.module_videos
         where module_id = $1)
     )
     returning id, url, label, position`,
    [moduleId, video.url, video.label || null],
  );

  return rows[0];
}

export async function updateVideo(moduleId, videoId, updates) {
  const fields = [];
  const params = [];

  if (updates.url !== undefined) {
    params.push(updates.url);
    fields.push(`url = $${params.length}`);
  }

  if (updates.label !== undefined) {
    params.push(updates.label || null);
    fields.push(`label = $${params.length}`);
  }

  if (updates.position !== undefined) {
    params.push(updates.position);
    fields.push(`position = $${params.length}`);
  }

  if (!fields.length) return null;

  params.push(videoId, moduleId);

  const { rows } = await dbQuery(
    `update public.module_videos
        set ${fields.join(', ')}
      where id = $${params.length - 1}
        and module_id = $${params.length}
      returning id, url, label, position`,
    params,
  );

  return rows[0] || null;
}

export async function deleteVideo(moduleId, videoId) {
  const { rows } = await dbQuery(
    `delete from public.module_videos
      where id = $1
        and module_id = $2
      returning id`,
    [videoId, moduleId],
  );

  return rows[0] || null;
}

export async function insertPresenter(name) {
  const { rows } = await dbQuery(
    `insert into public.presenters (name)
     values ($1)
     returning id, name, created_at`,
    [name],
  );

  return mapPresenter(rows[0]);
}

export async function updatePresenter(id, name) {
  const { rows } = await dbQuery(
    `update public.presenters
        set name = $2
      where id = $1
      returning id, name, created_at`,
    [id, name],
  );

  return rows[0] ? mapPresenter(rows[0]) : null;
}

export async function deletePresenter(id) {
  const { rows } = await dbQuery(
    `delete from public.presenters where id = $1 returning id`,
    [id],
  );

  return rows[0] || null;
}

export async function listPresenterPublishedModules(presenterId) {
  const { rows } = await dbQuery(
    `select m.id, m.title
       from public.module_presenters mp
       join public.modules m on m.id = mp.module_id
      where mp.presenter_id = $1
        and m.status = 'published'
      order by m.id`,
    [presenterId],
  );

  return rows;
}
