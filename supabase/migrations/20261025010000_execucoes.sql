-- ════════════════════════════════════════════════════════════════
-- Execução dos exercícios em GIF ou vídeo curto
--  • O admin gera para cada exercício do catálogo: GIF a partir de um banco público de fotos
--    (posição inicial e final) ou vídeo curto com IA a partir da foto do exercício.
--  • Tudo nasce como rascunho; só o que o admin aprova aparece para Personais e alunos
--    (no máximo uma execução aprovada por exercício).
-- Gravação só pelo servidor do admin (service role).
-- ════════════════════════════════════════════════════════════════

create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  kind text not null check (kind in ('gif', 'video')),
  source text not null check (source in ('banco_publico', 'ia')),
  -- gerando: vídeo de IA em produção (operation = id da operação no provedor)
  status text not null default 'rascunho' check (status in ('gerando', 'rascunho', 'aprovado', 'rejeitado', 'erro')),
  path text check (char_length(path) <= 300),
  operation text check (char_length(operation) <= 300),
  error text check (char_length(error) <= 1000),
  credit text check (char_length(credit) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  check (status in ('gerando', 'erro') or path is not null)
);
create unique index exercise_media_one_approved on public.exercise_media (equipment_id) where status = 'aprovado';
create index exercise_media_equipment_idx on public.exercise_media (equipment_id, created_at desc);

alter table public.exercise_media enable row level security;
revoke all on public.exercise_media from anon;
revoke insert, update, delete, truncate on public.exercise_media from authenticated;
create policy "execuções: todos veem as aprovadas" on public.exercise_media
  for select to authenticated using (status = 'aprovado');

-- Arquivos (GIF e MP4): leitura pública pelo caminho; escrita só pelo servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-media', 'exercise-media', true, 20971520, array['image/gif', 'video/mp4'])
on conflict (id) do nothing;
