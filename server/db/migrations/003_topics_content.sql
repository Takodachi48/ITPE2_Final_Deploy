-- 003_topics_content.sql
-- Creates `topics`, `topic_content`, and `topic_progress` tables.
-- Depends on: 002_subjects_enrollments.sql (run db:schema, then db:migrate).
-- Idempotent: safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. topics
-- ---------------------------------------------------------------------------
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  description text,
  available_from timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_subject_position_key
    unique (subject_id, position) deferrable initially deferred
);

create index if not exists topics_subject_idx
  on public.topics (subject_id);

create index if not exists topics_subject_status_idx
  on public.topics (subject_id, status);

-- updated_at trigger
drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

-- RLS: enabled, no policies (DEC-25)
alter table public.topics enable row level security;

-- ---------------------------------------------------------------------------
-- 2. topic_content
-- ---------------------------------------------------------------------------
create table if not exists public.topic_content (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  type text not null
    check (type in ('text', 'summary', 'notes', 'presentation', 'video', 'file')),
  title text,
  body text,                                           -- markdown for text/summary/notes
  url text,                                            -- Google Slides / video link
  file_path text, file_name text, file_mime text, file_size integer,
  visible_to_students boolean not null default true,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'presentation' or url is not null or file_path is not null),
  check (type <> 'video' or url is not null),
  check (type <> 'file' or file_path is not null),
  check (type not in ('text', 'summary', 'notes') or body is not null)
);

create index if not exists topic_content_topic_idx
  on public.topic_content (topic_id);

create index if not exists topic_content_topic_position_idx
  on public.topic_content (topic_id, position);

-- updated_at trigger
drop trigger if exists topic_content_set_updated_at on public.topic_content;
create trigger topic_content_set_updated_at
  before update on public.topic_content
  for each row execute function public.set_updated_at();

-- RLS: enabled, no policies (DEC-25)
alter table public.topic_content enable row level security;

-- ---------------------------------------------------------------------------
-- 3. topic_progress (only used for topics without a published quiz)
-- ---------------------------------------------------------------------------
create table if not exists public.topic_progress (
  student_id uuid not null references public.profiles(id),
  topic_id uuid not null references public.topics(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (student_id, topic_id)
);

create index if not exists topic_progress_student_idx
  on public.topic_progress (student_id);

create index if not exists topic_progress_topic_idx
  on public.topic_progress (topic_id);

-- RLS: enabled, no policies (DEC-25)
alter table public.topic_progress enable row level security;