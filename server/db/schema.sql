-- Systems Index database schema
-- Run with: npm run db:schema
-- Or paste into the Supabase dashboard SQL console.

create extension if not exists pgcrypto;

do $$
begin
  create type public.module_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.themes (
  id text primary key,
  label text not null,
  range_label text not null,
  blurb text not null,
  start_module integer not null check (start_module > 0),
  end_module integer not null check (end_module >= start_module),
  sort_order integer not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.modules (
  id integer primary key check (id > 0 and id <= 999),
  slug text not null unique,
  title text not null check (length(trim(title)) >= 2),
  description text not null check (length(trim(description)) >= 10),
  summary text not null default '',
  ppt_url text,
  status public.module_status not null default 'draft',
  theme_id text not null references public.themes(id) on update cascade on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.presenters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.module_videos (
  id uuid primary key default gen_random_uuid(),
  module_id integer not null references public.modules(id) on delete cascade,
  url text not null,
  label text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint module_videos_module_url_key unique (module_id, url)
);

create table if not exists public.module_presenters (
  module_id integer not null references public.modules(id) on delete cascade,
  presenter_id uuid not null references public.presenters(id) on delete cascade,
  role text not null default 'Presenter' check (length(trim(role)) > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (module_id, presenter_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student' check (role in ('admin', 'faculty', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists modules_theme_idx on public.modules (theme_id);
create index if not exists modules_status_idx on public.modules (status);
create index if not exists module_videos_module_position_idx
  on public.module_videos (module_id, position);
create index if not exists module_presenters_module_idx
  on public.module_presenters (module_id, position);
create unique index if not exists presenters_name_lower_idx
  on public.presenters (lower(name));
create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_module_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      new.published_at = coalesce(new.published_at, now());
    elsif old.status is distinct from 'published' then
      new.published_at = coalesce(new.published_at, now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

drop trigger if exists modules_set_published_at on public.modules;
create trigger modules_set_published_at
  before insert or update of status on public.modules
  for each row execute function public.set_module_published_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.has_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = any(allowed)
  );
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.has_role(text[]) to anon, authenticated;

alter table public.themes enable row level security;
alter table public.modules enable row level security;
alter table public.presenters enable row level security;
alter table public.module_videos enable row level security;
alter table public.module_presenters enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Themes are publicly readable" on public.themes;
create policy "Themes are publicly readable"
  on public.themes for select
  to anon, authenticated
  using (true);

drop policy if exists "Faculty manage themes" on public.themes;
create policy "Faculty manage themes"
  on public.themes for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Published modules are publicly readable" on public.modules;
create policy "Published modules are publicly readable"
  on public.modules for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Faculty manage modules" on public.modules;
create policy "Faculty manage modules"
  on public.modules for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Presenters are publicly readable" on public.presenters;
create policy "Presenters are publicly readable"
  on public.presenters for select
  to anon, authenticated
  using (true);

drop policy if exists "Faculty manage presenters" on public.presenters;
create policy "Faculty manage presenters"
  on public.presenters for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Videos for published modules are public" on public.module_videos;
create policy "Videos for published modules are public"
  on public.module_videos for select
  to anon, authenticated
  using (
    exists (
      select 1
        from public.modules m
       where m.id = module_videos.module_id
         and m.status = 'published'
    )
  );

drop policy if exists "Faculty manage videos" on public.module_videos;
create policy "Faculty manage videos"
  on public.module_videos for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Presenters on published modules are public" on public.module_presenters;
create policy "Presenters on published modules are public"
  on public.module_presenters for select
  to anon, authenticated
  using (
    exists (
      select 1
        from public.modules m
       where m.id = module_presenters.module_id
         and m.status = 'published'
    )
  );

drop policy if exists "Faculty manage module presenters" on public.module_presenters;
create policy "Faculty manage module presenters"
  on public.module_presenters for all
  to authenticated
  using (public.has_role(array['admin', 'faculty']))
  with check (public.has_role(array['admin', 'faculty']));

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.has_role(array['admin'])
  );

grant select on public.themes, public.modules, public.presenters,
  public.module_videos, public.module_presenters
  to anon, authenticated;

grant insert, update, delete on public.themes, public.modules,
  public.presenters, public.module_videos, public.module_presenters
  to authenticated;

grant select on public.profiles to authenticated;
