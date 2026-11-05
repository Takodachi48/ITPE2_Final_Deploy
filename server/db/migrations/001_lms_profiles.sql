-- 001_lms_profiles.sql
-- Extends `profiles` for the LMS: names, student number, approval status,
-- renamed roles (viewer->student, editor->faculty), and updated RLS policies.
-- Depends on: server/db/schema.sql (run db:schema first).
-- Idempotent: safe to run multiple times (db:migrate skips applied files anyway).

-- ---------------------------------------------------------------------------
-- 1. New profile columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists student_number text,
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected'));

-- Existing rows (created before this migration) are auto-approved.
update public.profiles
   set approval_status = 'approved'
 where approval_status is null;

-- ---------------------------------------------------------------------------
-- 2. Role rename: viewer -> student, editor -> faculty
--    ORDER MATTERS: drop the old check first, update rows, then add the new check.
--    VER-01: the existing constraint is named `profiles_role_check`.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;

update public.profiles set role = 'student' where role = 'viewer';
update public.profiles set role = 'faculty' where role = 'editor';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'faculty', 'student'));

alter table public.profiles alter column role set default 'student';

-- ---------------------------------------------------------------------------
-- 3. Unique index on student_number (case-insensitive, partial)
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_student_number_key
  on public.profiles (lower(student_number))
  where student_number is not null;

-- ---------------------------------------------------------------------------
-- 4. Signup trigger: copy names/student number from metadata, always role student
--    VER-03: trigger `on_auth_user_created` -> function `public.handle_new_user()`.
--    Never reads a role from metadata (anyone can call Supabase sign-up directly).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, first_name, last_name, student_number, full_name,
    role, approval_status
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'student_number',
    coalesce(
      new.raw_user_meta_data->>'full_name',
      nullif(
        trim(
          coalesce(new.raw_user_meta_data->>'first_name', '') || ' ' ||
          coalesce(new.raw_user_meta_data->>'last_name', '')
        ),
        ''
      )
    ),
    'student',
    'approved'
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        updated_at = now();

  return new;
end;
$$;

-- trigger already exists from schema.sql; recreate to be safe (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. RLS policies: rewrite 'editor' -> 'faculty' (AUTH-03)
--    Drop and recreate each legacy policy with the new role name.
-- ---------------------------------------------------------------------------
drop policy if exists "Editors manage themes" on public.themes;
create policy "Editors manage themes"
  on public.themes for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Editors manage modules" on public.modules;
create policy "Editors manage modules"
  on public.modules for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Editors manage presenters" on public.presenters;
create policy "Editors manage presenters"
  on public.presenters for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Editors manage videos" on public.module_videos;
create policy "Editors manage videos"
  on public.module_videos for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Editors manage module presenters" on public.module_presenters;
create policy "Editors manage module presenters"
  on public.module_presenters for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));