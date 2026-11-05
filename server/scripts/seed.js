import pg from 'pg';
import { modules, themes } from '../../src/data/modules.js';
import { databaseConfigured, env } from '../config/env.js';
import { getPgConfig } from '../db/config.js';
import { slugify } from '../utils/slug.js';

const { Client } = pg;

if (!databaseConfigured) {
  console.error(
    'DATABASE_URL is missing or still contains a placeholder. Add your Supabase Postgres connection string to .env first.',
  );
  process.exit(1);
}

const videosFor = (module) => {
  if (Array.isArray(module.videoUrls)) return module.videoUrls;
  if (Array.isArray(module.videoUrl)) return module.videoUrl;
  return module.videoUrl ? [module.videoUrl] : [];
};

const client = new Client({
  ...getPgConfig(),
  application_name: 'systems-index-seed',
});

let moduleCount = 0;
let presenterCount = 0;
let videoCount = 0;

try {
  await client.connect();
  console.log(
    `[seed] Seeding content into ${env.database.url.replace(/\/\/.*@/, '//***@')}`,
  );

  await client.query('begin');

  for (const [index, theme] of themes.entries()) {
    const start = Math.min(...theme.modules);
    const end = Math.max(...theme.modules);

    await client.query(
      `insert into public.themes
         (id, label, range_label, blurb, start_module, end_module, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update
         set label = excluded.label,
             range_label = excluded.range_label,
             blurb = excluded.blurb,
             start_module = excluded.start_module,
             end_module = excluded.end_module,
             sort_order = excluded.sort_order`,
      [theme.id, theme.label, theme.range, theme.blurb, start, end, index + 1],
    );
  }

  for (const module of modules) {
    const theme = themes.find((item) => item.modules.includes(module.id));
    if (!theme) {
      throw new Error(`Module ${module.id} does not belong to a theme.`);
    }

    const slug = slugify(module.title);

    await client.query(
      `insert into public.modules
         (id, slug, title, description, summary, ppt_url, status, theme_id)
       values ($1, $2, $3, $4, $5, $6, 'published', $7)
       on conflict (id) do update
         set slug = excluded.slug,
             title = excluded.title,
             description = excluded.description,
             summary = excluded.summary,
             ppt_url = excluded.ppt_url,
             status = excluded.status,
             theme_id = excluded.theme_id,
             updated_at = now()`,
      [
        module.id,
        slug,
        module.title,
        module.description,
        module.summary || '',
        module.pptUrl || null,
        theme.id,
      ],
    );

    await client.query(
      `delete from public.module_videos where module_id = $1`,
      [module.id],
    );

    const videos = videosFor(module).filter(Boolean);

    for (const [index, url] of videos.entries()) {
      await client.query(
        `insert into public.module_videos (module_id, url, label, position)
         values ($1, $2, $3, $4)`,
        [module.id, url, `Discussion ${String(index + 1).padStart(2, '0')}`, index],
      );
      videoCount += 1;
    }

    await client.query(
      `delete from public.module_presenters where module_id = $1`,
      [module.id],
    );

    for (const [index, member] of module.members.entries()) {
      const name = member.name.trim();

      await client.query(
        `insert into public.presenters (name)
         values ($1)
         on conflict do nothing`,
        [name],
      );

      const { rows } = await client.query(
        `select id from public.presenters where lower(name) = lower($1) limit 1`,
        [name],
      );

      if (!rows[0]) {
        throw new Error(`Could not resolve presenter ${name}.`);
      }

      await client.query(
        `insert into public.module_presenters
           (module_id, presenter_id, role, position)
         values ($1, $2, $3, $4)
         on conflict (module_id, presenter_id) do update
           set role = excluded.role,
               position = excluded.position`,
        [module.id, rows[0].id, member.role || 'Presenter', index],
      );
    }

    moduleCount += 1;
  }

  const { rows: totals } = await client.query(`
    select
      (select count(*)::int from public.modules) as modules,
      (select count(distinct presenter_id)::int from public.module_presenters) as presenters,
      (select count(*)::int from public.module_videos) as videos
  `);

  presenterCount = totals[0].presenters;
  videoCount = totals[0].videos;

  await client.query('commit');

  console.log(
    `[seed] Done: ${moduleCount} modules, ${presenterCount} unique presenters, ${videoCount} videos.`,
  );
} catch (error) {
  try {
    await client.query('rollback');
  } catch {
    // The connection may have failed before the transaction began.
  }

  console.error('[seed] Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
