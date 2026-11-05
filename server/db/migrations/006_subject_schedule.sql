-- 006_subject_schedule.sql
-- Add term start date and meeting day for subjects.

alter table public.subjects
  add column if not exists start_date date,
  add column if not exists meeting_day integer check (meeting_day between 0 and 6);
