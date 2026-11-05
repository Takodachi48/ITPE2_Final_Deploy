-- 007_alter_content_add_file.sql
-- Allow file type in topic_content

alter table public.topic_content drop constraint if exists topic_content_type_check;
alter table public.topic_content
  add constraint topic_content_type_check
    check (type in ('text', 'summary', 'notes', 'presentation', 'video', 'file'));

alter table public.topic_content drop constraint if exists topic_content_check;
alter table public.topic_content
  add constraint topic_content_check
    check (
      (type <> 'presentation' or url is not null or file_path is not null) and
      (type <> 'video' or url is not null) and
      (type <> 'file' or file_path is not null) and
      (type not in ('text', 'summary', 'notes') or body is not null)
    );
