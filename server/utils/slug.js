export function slugify(value = '') {
  return (
    String(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'module'
  );
}

export async function ensureUniqueSlug(client, desiredSlug, excludeId = null) {
  const base = slugify(desiredSlug);
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const { rows } = await client.query(
      `select 1
         from public.modules
        where slug = $1
          and ($2::int is null or id <> $2::int)
        limit 1`,
      [candidate, excludeId],
    );

    if (!rows.length) return candidate;

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
