-- 002_subjects_enrollments.sql
-- Creates `subjects` and `enrollments` tables for the LMS.
-- Depends on: 001_lms_profiles.sql (run db:schema, then db:migrate).
-- Idempotent: safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. subjects
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.profiles(id),
  code text not null,                                    -- "IT101", stored upper-case
  name text not null,
  description text,
  term text not null check (term in ('1st Semester', '2nd Semester', '3rd Semester', 'Summer')),
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  join_code text not null unique,                        -- 8 chars, see BR-12
  passing_percent integer not null default 75
    check (passing_percent between 1 and 100),
  enrollment_open boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_faculty_code_term_year_key
    unique (faculty_id, code, term, school_year)
);

create index if not exists subjects_faculty_idx
  on public.subjects (faculty_id);

create index if not exists subjects_status_idx
  on public.subjects (status);

-- updated_at trigger
drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- RLS: enabled, no policies (DEC-25)
alter table public.subjects enable row level security;

-- ---------------------------------------------------------------------------
-- 2. enrollments
-- ---------------------------------------------------------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  status text not null default 'active'
    check (status in ('active', 'removed')),
  enrolled_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_subject_student_key
    unique (subject_id, student_id)
);

create index if not exists enrollments_subject_idx
  on public.enrollments (subject_id);

create index if not exists enrollments_student_idx
  on public.enrollments (student_id);

create index if not exists enrollments_status_idx
  on public.enrollments (status);

-- updated_at trigger
drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

-- RLS: enabled, no policies (DEC-25)
alter table public.enrollments enable row level security;