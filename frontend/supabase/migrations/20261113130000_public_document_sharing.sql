create table if not exists public.note_shared_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_document_id text not null check (
    char_length(client_document_id) between 1 and 160
  ),
  storage_path text not null unique check (
    storage_path !~ '(^/|(^|/)\.\.?(/|$))'
  ),
  name text not null check (char_length(name) between 1 and 240),
  description text not null default '' check (char_length(description) <= 1000),
  file_type text not null check (
    file_type in ('pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx', 'epub', 'md', 'txt', 'image')
  ),
  content_type text not null check (char_length(content_type) <= 160),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  updated_at timestamptz not null default now(),
  unique (owner_id, client_document_id),
  unique (id, owner_id)
);

create table if not exists public.note_document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  enabled boolean not null default true,
  can_download boolean not null default false,
  description text not null default '' check (char_length(description) <= 1000),
  password_hash text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (document_id, owner_id)
    references public.note_shared_documents (id, owner_id) on delete cascade
);

create unique index if not exists note_document_shares_one_active_per_document
  on public.note_document_shares (document_id)
  where enabled;

create index if not exists note_document_shares_owner_updated
  on public.note_document_shares (owner_id, updated_at desc);

create or replace function public.create_note_document_share(
  p_owner_id uuid,
  p_client_document_id text,
  p_storage_path text,
  p_name text,
  p_document_description text,
  p_file_type text,
  p_content_type text,
  p_size_bytes bigint,
  p_token_hash text,
  p_can_download boolean,
  p_share_description text,
  p_password_hash text,
  p_expires_at timestamptz
)
returns table (
  document_id uuid,
  share_id uuid,
  enabled boolean,
  can_download boolean,
  description text,
  password_hash text,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document_id uuid;
  v_share public.note_document_shares%rowtype;
begin
  insert into public.note_shared_documents (
    owner_id,
    client_document_id,
    storage_path,
    name,
    description,
    file_type,
    content_type,
    size_bytes
  )
  values (
    p_owner_id,
    p_client_document_id,
    p_storage_path,
    p_name,
    p_document_description,
    p_file_type,
    p_content_type,
    p_size_bytes
  )
  on conflict (owner_id, client_document_id) do update set
    storage_path = excluded.storage_path,
    name = excluded.name,
    description = excluded.description,
    file_type = excluded.file_type,
    content_type = excluded.content_type,
    size_bytes = excluded.size_bytes,
    updated_at = now()
  returning id into v_document_id;

  if exists (
    select 1
    from public.note_document_shares
    where note_document_shares.document_id = v_document_id
      and note_document_shares.enabled
  ) then
    raise exception 'Document already has an enabled share.';
  end if;

  insert into public.note_document_shares (
    document_id,
    owner_id,
    token_hash,
    can_download,
    description,
    password_hash,
    expires_at
  )
  values (
    v_document_id,
    p_owner_id,
    p_token_hash,
    p_can_download,
    p_share_description,
    p_password_hash,
    p_expires_at
  )
  returning * into v_share;

  return query
    select
      v_document_id,
      v_share.id,
      v_share.enabled,
      v_share.can_download,
      v_share.description,
      v_share.password_hash,
      v_share.expires_at,
      v_share.created_at,
      v_share.updated_at,
      v_share.revoked_at;
end;
$$;

revoke all on function public.create_note_document_share(
  uuid, text, text, text, text, text, text, bigint, text, boolean, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_note_document_share(
  uuid, text, text, text, text, text, text, bigint, text, boolean, text, text, timestamptz
) to service_role;

alter table public.note_shared_documents enable row level security;
alter table public.note_document_shares enable row level security;

revoke all on public.note_shared_documents from anon, authenticated;
revoke all on public.note_document_shares from anon, authenticated;
grant all on public.note_shared_documents to service_role;
grant all on public.note_document_shares to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'note-private-documents',
  'note-private-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/octet-stream',
    'application/epub+zip',
    'text/markdown',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/bmp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "note owners manage their private shared files"
  on storage.objects;

create policy "note owners manage their private shared files"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'note-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'note-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
