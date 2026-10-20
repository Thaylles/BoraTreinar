-- ════════════════════════════════════════════════════════════════
-- Anamnese / PAR-Q do aluno
--  • Respostas padronizadas (códigos fixos) para o Personal fazer levantamento.
--  • "Sim" no PAR-Q pede liberação médica (arquivo privado no bucket "medical").
--  • O aluno preenche; Personais vinculados leem e são avisados.
-- ════════════════════════════════════════════════════════════════

create table public.health_forms (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  parq_yes text[] not null default '{}' check (parq_yes <@ array['coracao', 'dor_peito_atividade', 'dor_peito_repouso', 'tontura', 'osso_articulacao', 'remedio_pressao', 'outro_motivo']),
  pain_regions text[] not null default '{}' check (pain_regions <@ array['cervical', 'ombro', 'cotovelo', 'punho', 'toracica', 'lombar', 'quadril', 'joelho', 'tornozelo']),
  injury_regions text[] not null default '{}' check (injury_regions <@ array['cervical', 'ombro', 'cotovelo', 'punho', 'toracica', 'lombar', 'quadril', 'joelho', 'tornozelo']),
  mobility_regions text[] not null default '{}' check (mobility_regions <@ array['cervical', 'ombro', 'cotovelo', 'punho', 'toracica', 'lombar', 'quadril', 'joelho', 'tornozelo']),
  muscle_pain text[] not null default '{}' check (muscle_pain <@ array['peito', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco', 'quadriceps', 'posterior', 'gluteos', 'adutores', 'panturrilha', 'abdomen']),
  surgeries text[] not null default '{}' check (surgeries <@ array['joelho', 'ombro', 'coluna', 'quadril', 'cardiaca', 'abdominal', 'outra']),
  conditions text[] not null default '{}' check (conditions <@ array['hipertensao', 'diabetes', 'colesterol', 'cardiaco', 'asma', 'tireoide', 'labirintite', 'hernia_disco', 'artrose', 'osteoporose', 'ansiedade_depressao', 'gestante']),
  medications text[] not null default '{}' check (medications <@ array['pressao', 'diabetes', 'antidepressivo', 'hormonal', 'anti_inflamatorio', 'tireoide', 'outro']),
  goals text[] not null default '{}' check (goals <@ array['emagrecimento', 'hipertrofia', 'condicionamento', 'saude', 'forca', 'mobilidade', 'reabilitacao', 'performance']),
  activity_level text check (activity_level = any (array['sedentario', 'pouco_ativo', 'ativo', 'muito_ativo'])),
  experience text check (experience = any (array['nunca', 'menos_6m', 'ate_2a', 'mais_2a'])),
  sleep text check (sleep = any (array['menos_5', '5_6', '7_8', 'mais_8'])),
  smoker boolean,
  notes text check (notes is null or char_length(notes) <= 1000),
  -- Liberação médica: caminho no bucket "medical" (pasta do próprio aluno).
  clearance_path text check (clearance_path is null or clearance_path like student_id::text || '/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.health_forms enable row level security;
revoke all on public.health_forms from anon;
revoke insert, update, delete, truncate on public.health_forms from authenticated;
create policy "anamnese: aluno e Personais vinculados leem" on public.health_forms
  for select to authenticated using (student_id = (select auth.uid()) or public.is_linked_personal(student_id));

/** Avisa os Personais ativos do aluno. */
create function private.notify_student_personals(p_student uuid, p_title text, p_body text) returns void
language sql security definer set search_path = '' as $$
  select public.notify(ps.personal_id, p_title, p_body, '/personal/alunos/' || p_student)
    from public.personal_students ps where ps.student_id = p_student and ps.status = 'ativo' and ps.personal_id <> p_student;
$$;
revoke execute on function private.notify_student_personals(uuid, text, text) from public, anon, authenticated;

/** O aluno salva (ou atualiza) a própria anamnese. Os códigos são validados pelas restrições da tabela. */
create function public.save_health_form(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  old public.health_forms;
  v_name text;
  arr text[];
begin
  if v_me is null or not public.current_role_is('aluno') then
    raise exception 'Só o aluno preenche a própria anamnese' using errcode = '42501';
  end if;
  select * into old from public.health_forms where student_id = v_me;
  insert into public.health_forms as h (student_id, parq_yes, pain_regions, injury_regions, mobility_regions, muscle_pain,
                                        surgeries, conditions, medications, goals, activity_level, experience, sleep, smoker, notes, updated_at)
  values (
    v_me,
    array(select distinct jsonb_array_elements_text(coalesce(p->'parq_yes', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'pain_regions', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'injury_regions', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'mobility_regions', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'muscle_pain', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'surgeries', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'conditions', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'medications', '[]'))),
    array(select distinct jsonb_array_elements_text(coalesce(p->'goals', '[]'))),
    nullif(p->>'activity_level', ''), nullif(p->>'experience', ''), nullif(p->>'sleep', ''),
    (p->>'smoker')::boolean, nullif(left(trim(coalesce(p->>'notes', '')), 1000), ''), now()
  )
  on conflict (student_id) do update set
    parq_yes = excluded.parq_yes, pain_regions = excluded.pain_regions, injury_regions = excluded.injury_regions,
    mobility_regions = excluded.mobility_regions, muscle_pain = excluded.muscle_pain, surgeries = excluded.surgeries,
    conditions = excluded.conditions, medications = excluded.medications, goals = excluded.goals,
    activity_level = excluded.activity_level, experience = excluded.experience, sleep = excluded.sleep,
    smoker = excluded.smoker, notes = excluded.notes, updated_at = now()
  returning h.parq_yes into arr;

  select full_name into v_name from public.profiles where id = v_me;
  if cardinality(arr) > 0 and (old.student_id is null or not (arr <@ old.parq_yes)) then
    perform private.notify_student_personals(v_me, '⚠️ Anamnese com pontos de atenção',
      v_name || ' respondeu "sim" no PAR-Q. Veja a ficha de saúde e peça a liberação médica antes de intensificar os treinos.');
  elsif old.student_id is null then
    perform private.notify_student_personals(v_me, '🩺 Anamnese preenchida', v_name || ' preencheu a ficha de saúde.');
  end if;
end;
$$;

/** O aluno anexa (ou remove, com null) a liberação médica já enviada para a pasta dele. */
create function public.set_health_clearance(p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_name text;
begin
  if v_me is null or not exists (select 1 from public.health_forms where student_id = v_me) then
    raise exception 'Preencha a anamnese antes de enviar a liberação' using errcode = 'P0001';
  end if;
  if p_path is not null and (p_path not like v_me::text || '/%'
     or not exists (select 1 from storage.objects where bucket_id = 'medical' and name = p_path)) then
    raise exception 'Arquivo inválido' using errcode = 'P0001';
  end if;
  update public.health_forms set clearance_path = p_path, updated_at = now() where student_id = v_me;
  if p_path is not null then
    select full_name into v_name from public.profiles where id = v_me;
    perform private.notify_student_personals(v_me, '📄 Liberação médica enviada', v_name || ' enviou a liberação médica.');
  end if;
end;
$$;

revoke execute on function public.save_health_form(jsonb), public.set_health_clearance(text) from public, anon;
grant execute on function public.save_health_form(jsonb), public.set_health_clearance(text) to authenticated;

-- ─── Liberação médica (arquivo privado) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical', 'medical', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "medical: aluno envia na própria pasta" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'medical' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "medical: aluno e Personais vinculados leem" on storage.objects
  for select to authenticated using (
    bucket_id = 'medical' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_linked_personal(((storage.foldername(name))[1])::uuid)
    )
  );
create policy "medical: aluno exclui" on storage.objects
  for delete to authenticated using (bucket_id = 'medical' and (storage.foldername(name))[1] = (select auth.uid())::text);
