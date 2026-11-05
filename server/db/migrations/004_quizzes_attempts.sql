-- 004_quizzes_attempts.sql
-- Creates `quizzes`, `questions`, and `attempts` tables.
-- Depends on: 003_topics_content.sql.
-- Idempotent: safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. quizzes
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique references public.topics(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('built', 'uploaded')),
  instructions text,
  total_items integer check (total_items between 1 and 1000),
  external_url text,
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  max_attempts smallint check (max_attempts is null or max_attempts > 0),
  show_answers boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mode <> 'uploaded' or total_items is not null)
);

create index if not exists quizzes_topic_idx on public.quizzes (topic_id);

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

alter table public.quizzes enable row level security;

-- ---------------------------------------------------------------------------
-- 2. questions
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null,
  type text not null check (type in ('choice', 'text')),
  prompt text not null,
  options jsonb,
  correct_option_id text,
  accepted_answers text[],
  points numeric(5,2) not null default 1 check (points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_quiz_position_key unique (quiz_id, position) deferrable initially deferred
);

create index if not exists questions_quiz_idx on public.questions (quiz_id);

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

alter table public.questions enable row level security;

-- ---------------------------------------------------------------------------
-- 3. attempts
-- ---------------------------------------------------------------------------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  attempt_no integer not null,
  source text not null check (source in ('auto', 'manual')),
  status text not null check (status in ('in_progress', 'pending_review', 'graded')),
  answers jsonb,
  score numeric(6,2),
  total numeric(6,2),
  image_path text,
  feedback text,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attempts_quiz_student_no_key unique (quiz_id, student_id, attempt_no),
  check (status <> 'graded' or (score is not null and total is not null and score between 0 and total))
);

create index if not exists attempts_student_quiz_idx on public.attempts (student_id, quiz_id);

-- Partial unique index: only one open attempt per student per quiz
create unique index if not exists attempts_open_unique_idx
  on public.attempts (quiz_id, student_id)
  where status in ('in_progress', 'pending_review');

drop trigger if exists attempts_set_updated_at on public.attempts;
create trigger attempts_set_updated_at
  before update on public.attempts
  for each row execute function public.set_updated_at();

alter table public.attempts enable row level security;