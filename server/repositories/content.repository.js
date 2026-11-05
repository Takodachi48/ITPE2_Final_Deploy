import { dbQuery } from '../db/pool.js';
import { mapModule, mapPresenter, mapTheme } from '../utils/mappers.js';

const MODULE_SELECT = `
  select
    m.id,
    m.slug,
    m.title,
    m.description,
    m.summary,
    m.ppt_url,
    m.status,
    m.published_at,
    m.created_at,
    m.updated_at,
    m.theme_id,
    t.label as theme_label,
    t.range_label as theme_range,
    t.blurb as theme_blurb,
    coalesce((
      select json_agg(
        json_build_object(
          'id', v.id,
          'url', v.url,
          'label', v.label,
          'position', v.position
        )
        order by v.position, v.created_at
      )
      from public.module_videos v
      where v.module_id = m.id
    ), '[]'::json) as videos,
    coalesce((
      select json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'role', mp.role,
          'position', mp.position
        )
        order by mp.position, p.name
      )
      from public.module_presenters mp
      join public.presenters p on p.id = mp.presenter_id
      where mp.module_id = m.id
    ), '[]'::json) as presenters
  from public.modules m
  join public.themes t on t.id = m.theme_id
`;

const buildFilters = ({
  q,
  theme,
  presenter,
  status,
  idOrSlug,
  includeDrafts = false,
}) => {
  const params = [];
  const clauses = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (!includeDrafts) {
    clauses.push(`m.status = 'published'`);
  } else if (status) {
    clauses.push(`m.status = ${addParam(status)}`);
  }

  if (q) {
    const placeholder = addParam(`%${q}%`);
    clauses.push(`(
      m.title ilike ${placeholder}
      or m.description ilike ${placeholder}
      or m.summary ilike ${placeholder}
      or exists (
        select 1
          from public.module_presenters smp
          join public.presenters sp on sp.id = smp.presenter_id
         where smp.module_id = m.id
           and sp.name ilike ${placeholder}
      )
    )`);
  }

  if (theme) {
    clauses.push(`m.theme_id = ${addParam(theme)}`);
  }

  if (presenter) {
    const placeholder = addParam(presenter);
    clauses.push(`exists (
      select 1
        from public.module_presenters pmp
       where pmp.module_id = m.id
         and pmp.presenter_id = ${placeholder}::uuid
    )`);
  }

  if (idOrSlug) {
    const placeholder = addParam(idOrSlug);
    clauses.push(`(m.id::text = ${placeholder} or m.slug = ${placeholder})`);
  }

  return {
    params,
    where: clauses.length ? `where ${clauses.join(' and ')}` : '',
  };
};

export async function listModules(options = {}) {
  const { limit = 100, offset = 0, includeDrafts = false } = options;
  const { params, where } = buildFilters({ ...options, includeDrafts });

  const limitPlaceholder = `$${params.length + 1}`;
  const offsetPlaceholder = `$${params.length + 2}`;
  const rowsParams = [...params, limit, offset];

  const [rowsResult, countResult] = await Promise.all([
    dbQuery(
      `${MODULE_SELECT}
       ${where}
       order by m.id asc
       limit ${limitPlaceholder} offset ${offsetPlaceholder}`,
      rowsParams,
    ),
    dbQuery(
      `select count(*)::int as total
         from public.modules m
         ${where}`,
      params,
    ),
  ]);

  return {
    data: rowsResult.rows.map(mapModule),
    total: countResult.rows[0]?.total || 0,
    limit,
    offset,
  };
}

export async function findModule(idOrSlug, { includeDrafts = false } = {}) {
  const { data } = await listModules({
    idOrSlug: String(idOrSlug),
    includeDrafts,
    limit: 1,
    offset: 0,
  });

  return data[0] || null;
}

export async function listThemes({ includeDrafts = false } = {}) {
  const publishedClause = includeDrafts ? '' : `and m.status = 'published'`;

  const { rows } = await dbQuery(`
    select
      t.id,
      t.label,
      t.range_label,
      t.blurb,
      t.start_module,
      t.end_module,
      t.sort_order,
      coalesce(
        json_agg(m.id order by m.id) filter (where m.id is not null),
        '[]'::json
      ) as module_ids
    from public.themes t
    left join public.modules m
      on m.theme_id = t.id
      ${publishedClause}
    group by t.id
    order by t.sort_order asc, t.id asc
  `);

  return rows.map(mapTheme);
}

export async function listPresenters({ q = '', includeDrafts = false } = {}) {
  const publishedClause = includeDrafts ? '' : `and m.status = 'published'`;
  const needle = q ? `%${q}%` : '';

  const { rows } = await dbQuery(
    `
      select
        p.id,
        p.name,
        p.created_at,
        coalesce(
          json_agg(
            json_build_object('id', m.id, 'title', m.title)
            order by m.id
          ) filter (where m.id is not null),
          '[]'::json
        ) as modules
      from public.presenters p
      left join public.module_presenters mp on mp.presenter_id = p.id
      left join public.modules m
        on m.id = mp.module_id
        ${publishedClause}
      where ($1 = '' or p.name ilike $1)
      group by p.id
      order by p.name asc
    `,
    [needle],
  );

  return rows.map(mapPresenter);
}

export async function getStats({ includeDrafts = false } = {}) {
  const statusClause = includeDrafts ? '' : `where m.status = 'published'`;

  const { rows } = await dbQuery(`
    select
      (select count(*)::int from public.modules m ${statusClause}) as modules,
      (
        select count(distinct mp.presenter_id)::int
          from public.module_presenters mp
          join public.modules m on m.id = mp.module_id
          ${statusClause}
      ) as presenters,
      (select count(*)::int from public.themes) as themes,
      (
        select count(*)::int
          from public.module_videos v
          join public.modules m on m.id = v.module_id
          ${statusClause}
      ) as videos
  `);

  return rows[0];
}

export async function getSiteContent() {
  const [modulesResult, themes, stats] = await Promise.all([
    listModules({ limit: 100, offset: 0, includeDrafts: false }),
    listThemes({ includeDrafts: false }),
    getStats({ includeDrafts: false }),
  ]);

  return {
    modules: modulesResult.data,
    themes,
    stats,
  };
}
