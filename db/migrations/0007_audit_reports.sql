-- Append-only журнал административных изменений и сообщения пользователей об ошибках.

create table if not exists admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  actor_role text not null check (actor_role in ('admin', 'editor')),
  action text not null check (char_length(action) between 1 and 64),
  entity_type text not null check (char_length(entity_type) between 1 and 64),
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_created_idx
  on admin_audit_log(actor_user_id, created_at desc);
create index if not exists admin_audit_log_entity_created_idx
  on admin_audit_log(entity_type, entity_id, created_at desc);
create index if not exists admin_audit_log_created_idx
  on admin_audit_log(created_at desc);

create or replace function prevent_admin_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_log is append-only';
end;
$$;

drop trigger if exists admin_audit_log_append_only on admin_audit_log;
create trigger admin_audit_log_append_only
before update or delete or truncate on admin_audit_log
for each statement execute function prevent_admin_audit_log_mutation();

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  object_id uuid references objects(id) on delete set null,
  object_title text not null,
  message text not null
    check (char_length(btrim(message)) between 10 and 2000),
  contact text
    check (contact is null or char_length(contact) <= 300),
  status text not null default 'new'
    check (status in ('new', 'resolved', 'rejected')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'new' and resolved_by is null and resolved_at is null)
    or
    (status in ('resolved', 'rejected') and resolved_by is not null and resolved_at is not null)
  )
);

create index if not exists content_reports_status_created_idx
  on content_reports(status, created_at desc);
create index if not exists content_reports_object_created_idx
  on content_reports(object_id, created_at desc);
create index if not exists content_reports_created_idx
  on content_reports(created_at desc);
