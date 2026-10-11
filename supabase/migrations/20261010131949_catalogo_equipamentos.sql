-- ════════════════════════════════════════════════════════════════
-- Etapa 3 — Catálogo de equipamentos/exercícios + imagens no Storage
-- ════════════════════════════════════════════════════════════════

create type public.muscle_group as enum (
  'peito', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco',
  'quadriceps', 'posterior', 'gluteos', 'adutores', 'panturrilha',
  'abdomen', 'cardio', 'corpo_inteiro'
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  muscle_group public.muscle_group not null,
  description text check (description is null or char_length(description) <= 1000),
  -- Imagem enviada pelo Personal (caminho no bucket "equipment")...
  image_path text,
  -- ...ou imagem estática do catálogo padrão (ilustração própria / Wikimedia Commons).
  image_url text,
  image_credit text,
  is_bodyweight boolean not null default false,
  is_default boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index equipment_default_name on public.equipment (lower(name)) where is_default;
create unique index equipment_owner_name on public.equipment (created_by, lower(name)) where not is_default;
create index equipment_group_idx on public.equipment (muscle_group);
create trigger equipment_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

/**
 * O usuário logado "conhece" o Personal p? Verdadeiro se for ele mesmo,
 * se for aluno vinculado a p, ou se for Personal que acompanha um aluno de p.
 * Usado para que alunos e Personais compartilhados vejam os exercícios criados por p.
 */
create function public.knows_personal(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p = auth.uid()
    or exists (
      select 1 from public.personal_students
      where personal_id = p and student_id = auth.uid() and status = 'ativo'
    )
    or exists (
      select 1 from public.personal_students a
      join public.personal_students b on b.student_id = a.student_id
      where a.personal_id = auth.uid() and a.status = 'ativo'
        and b.personal_id = p and b.status = 'ativo'
    );
$$;
revoke execute on function public.knows_personal(uuid) from public, anon;
grant execute on function public.knows_personal(uuid) to authenticated;

alter table public.equipment enable row level security;
revoke all on public.equipment from anon;
revoke update on public.equipment from authenticated;
grant update (name, muscle_group, description, image_path, is_bodyweight) on public.equipment to authenticated;

create policy "equipamentos: padrão e de Personais conhecidos" on public.equipment
  for select to authenticated using (is_default or public.knows_personal(created_by));
create policy "equipamentos: Personal cria os seus" on public.equipment
  for insert to authenticated with check (
    created_by = (select auth.uid()) and not is_default
    and image_url is null and image_credit is null
    and public.current_role_is('personal')
  );
create policy "equipamentos: Personal edita os seus" on public.equipment
  for update to authenticated
  using (created_by = (select auth.uid()) and not is_default)
  with check (created_by = (select auth.uid()) and not is_default);
create policy "equipamentos: Personal exclui os seus" on public.equipment
  for delete to authenticated using (created_by = (select auth.uid()) and not is_default);

-- ─── Storage: bucket público de imagens de equipamentos ────────
-- Leitura pública (são fotos de aparelhos); escrita só do Personal na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipment', 'equipment', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "equipment: Personal envia na própria pasta" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'equipment'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_role_is('personal')
  );
create policy "equipment: dono atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'equipment' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'equipment' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "equipment: dono exclui" on storage.objects
  for delete to authenticated
  using (bucket_id = 'equipment' and owner_id = (select auth.uid())::text);
