-- Cache das consultas à tabela FIPE (acessado só pela Edge Function, com a service role).
create table public.fipe_cache (
  chave text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.fipe_cache enable row level security;
revoke all on public.fipe_cache from anon, authenticated;
