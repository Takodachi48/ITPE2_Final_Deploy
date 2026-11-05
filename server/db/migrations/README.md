# Migrations

Numbered SQL files (`NNN_name.sql`) applied in filename order by `npm run db:migrate`.

- Each file runs in its own transaction.
- Applied filenames are recorded in `public.schema_migrations` and skipped on
  subsequent runs, so running `npm run db:migrate` twice changes nothing.
- Migrations are additive and idempotent: use `if not exists`, `create or replace`,
  `drop ... if exists`. Never edit a migration that has been merged; add a new one.
- Run `npm run db:schema` first (creates the base schema + `schema_migrations`),
  then `npm run db:migrate`.
