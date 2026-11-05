-- 005_performance_indexes.sql
-- Performance indexes for reports/progress (RPT-04).

-- Ensure foreign keys used in joins are indexed
create index if not exists quizzes_topic_id_idx on public.quizzes (topic_id);
create index if not exists questions_quiz_id_idx on public.questions (quiz_id);
create index if not exists attempts_quiz_id_idx on public.attempts (quiz_id);
create index if not exists attempts_student_id_idx on public.attempts (student_id);
create index if not exists topic_progress_topic_id_idx on public.topic_progress (topic_id);
create index if not exists topic_content_topic_id_idx on public.topic_content (topic_id);

-- Helpful for filtering attempts by status
create index if not exists attempts_status_idx on public.attempts (status);
