-- ════════════════════════════════════════════════════════════════
-- Pedido de troca de aula pelo aluno e meta de cardio escolhida pelo aluno
--  • O aluno pede para trocar uma aula (uma data) para outro dia/horário na mesma semana
--    (seg–dom) ou na semana seguinte. O Personal da aula aceita (a aula é remarcada) ou
--    recusa (com resposta opcional). O aluno pode desistir enquanto estiver pendente.
--  • A meta semanal de cardio pode ser definida pelo próprio aluno mesmo com Personal;
--    o Personal responsável é avisado.
-- ════════════════════════════════════════════════════════════════

create table public.class_change_requests (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.class_schedules (id) on delete cascade,
  on_date date not null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  personal_id uuid not null references public.profiles (id) on delete cascade,
  new_date date not null,
  new_time time not null,
  note text check (char_length(note) <= 300),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado', 'cancelado')),
  reply text check (char_length(reply) <= 300),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
-- Um pedido pendente por data de aula.
create unique index class_change_requests_one_pending on public.class_change_requests (schedule_id, on_date)
  where status = 'pendente';
create index class_change_requests_personal_idx on public.class_change_requests (personal_id, status);
create index class_change_requests_student_idx on public.class_change_requests (student_id, created_at desc);

alter table public.class_change_requests enable row level security;
revoke all on public.class_change_requests from anon;
revoke insert, update, delete, truncate on public.class_change_requests from authenticated;
create policy "trocas de aula: aluno e Personal da aula veem" on public.class_change_requests
  for select to authenticated using (student_id = (select auth.uid()) or personal_id = (select auth.uid()));

/**
 * O aluno pede para trocar a aula de p_date para p_new_date às p_new_time.
 * A nova data tem de ser de hoje em diante, na mesma semana (seg–dom) da aula ou na seguinte.
 */
create function public.request_class_change(p_schedule uuid, p_date date, p_new_date date, p_new_time time,
                                            p_note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  dias text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  s public.class_schedules;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week date;
  v_id uuid;
  v_student text;
begin
  select * into s from public.class_schedules where id = p_schedule;
  if s.id is null or s.student_id is distinct from auth.uid() then
    raise exception 'Aula não encontrada' using errcode = '42501';
  end if;
  if not exists (select 1 from public.personal_students ps
                  where ps.personal_id = s.personal_id and ps.student_id = s.student_id and ps.status = 'ativo') then
    raise exception 'Você não treina mais com esse Personal' using errcode = 'P0001';
  end if;
  if p_date is null or p_new_date is null or p_new_time is null then
    raise exception 'Escolha o novo dia e o horário' using errcode = 'P0001';
  end if;
  if extract(dow from p_date)::smallint <> s.weekday or p_date < s.starts_on
     or (s.ends_on is not null and p_date > s.ends_on)
     or exists (select 1 from public.class_exceptions e where e.schedule_id = s.id and e.on_date = p_date) then
    raise exception 'Essa aula não acontece nessa data' using errcode = 'P0001';
  end if;
  if p_date < v_today then
    raise exception 'Essa aula já passou' using errcode = 'P0001';
  end if;
  v_week := date_trunc('week', p_date)::date;
  if p_new_date < v_today or p_new_date < v_week or p_new_date > v_week + 13 then
    raise exception 'Escolha um dia da mesma semana da aula ou da semana seguinte' using errcode = 'P0001';
  end if;
  if p_new_date = p_date and p_new_time = s.start_time then
    raise exception 'Escolha um dia ou horário diferente' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.class_change_requests r
              where r.schedule_id = s.id and r.on_date = p_date and r.status = 'pendente') then
    raise exception 'Você já pediu a troca dessa aula; aguarde a resposta do Personal' using errcode = 'P0001';
  end if;

  insert into public.class_change_requests (schedule_id, on_date, student_id, personal_id, new_date, new_time, note)
    values (s.id, p_date, s.student_id, s.personal_id, p_new_date, p_new_time, nullif(left(trim(p_note), 300), ''))
    returning id into v_id;

  select full_name into v_student from public.profiles where id = s.student_id;
  perform public.notify(s.personal_id, 'Pedido de troca de aula 🔄',
    v_student || ' pediu para trocar a aula de ' || to_char(p_date, 'DD/MM') || ' às ' || to_char(s.start_time, 'HH24:MI')
      || ' para ' || dias[extract(dow from p_new_date)::int + 1] || ', ' || to_char(p_new_date, 'DD/MM')
      || ' às ' || to_char(p_new_time, 'HH24:MI') || '.',
    '/personal/agenda');
  return v_id;
end;
$$;

/** O aluno desiste de um pedido ainda pendente. */
create function public.cancel_class_change(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.class_change_requests
     set status = 'cancelado', answered_at = now()
   where id = p_request and student_id = auth.uid() and status = 'pendente';
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0001';
  end if;
end;
$$;

/**
 * O Personal da aula responde ao pedido. Aceitar remarca a aula (o aluno é avisado pela
 * remarcação); recusar avisa o aluno, com a resposta opcional.
 */
create function public.answer_class_change(p_request uuid, p_accept boolean, p_reply text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.class_change_requests;
  v_personal text;
  v_time time;
begin
  select * into r from public.class_change_requests where id = p_request for update;
  if r.id is null or r.personal_id is distinct from auth.uid() then
    raise exception 'Pedido não encontrado' using errcode = '42501';
  end if;
  if r.status <> 'pendente' then
    raise exception 'Esse pedido já foi respondido' using errcode = 'P0001';
  end if;

  if p_accept then
    perform public.reschedule_class_once(r.schedule_id, r.on_date, r.new_date, r.new_time);
  else
    select full_name into v_personal from public.profiles where id = r.personal_id;
    select start_time into v_time from public.class_schedules where id = r.schedule_id;
    perform public.notify(r.student_id, 'Troca de aula não aceita',
      v_personal || ' não pôde trocar a aula de ' || to_char(r.on_date, 'DD/MM') || ' às ' || to_char(v_time, 'HH24:MI')
        || coalesce(': ' || nullif(trim(p_reply), ''), '. A aula continua no horário de sempre.'),
      '/aluno/aulas');
  end if;

  update public.class_change_requests
     set status = case when p_accept then 'aceito' else 'recusado' end,
         reply = nullif(left(trim(p_reply), 300), ''),
         answered_at = now()
   where id = r.id;
end;
$$;

revoke execute on function public.request_class_change(uuid, date, date, time, text),
  public.cancel_class_change(uuid), public.answer_class_change(uuid, boolean, text) from public, anon;
grant execute on function public.request_class_change(uuid, date, date, time, text),
  public.cancel_class_change(uuid), public.answer_class_change(uuid, boolean, text) to authenticated;

-- ─── Meta de cardio: o aluno sempre pode escolher a sua ─────────
-- Recriada (drop + create): em alguns bancos o parâmetro tem outro nome e o "or replace" falha.
drop function private.can_edit_cardio_goal(uuid);
create function private.can_edit_cardio_goal(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_linked_personal(p_student) or (p_student = auth.uid() and public.can_train_self());
$$;
revoke execute on function private.can_edit_cardio_goal(uuid) from public, anon, authenticated;

create or replace function public.set_cardio_goal(p_student uuid, p_kind text, p_target numeric,
                                                  p_min_speed numeric default null, p_min_level int default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_label text;
  v_personal uuid;
begin
  if p_student is null or not private.can_edit_cardio_goal(p_student) then
    raise exception 'Você não pode alterar a meta de cardio deste aluno' using errcode = '42501';
  end if;
  if p_kind not in ('minutos', 'distancia', 'intenso') or p_target is null or p_target <= 0 or p_target > 5000 then
    raise exception 'Meta inválida' using errcode = 'P0001';
  end if;
  if p_kind = 'intenso' and p_min_speed is null and p_min_level is null then
    raise exception 'Informe a velocidade ou o nível que conta como ritmo forte' using errcode = 'P0001';
  end if;
  insert into public.cardio_goals (student_id, kind, target, min_speed_kmh, min_level, set_by, updated_at)
  values (p_student, p_kind, round(p_target, 1),
          case when p_kind = 'intenso' then p_min_speed end,
          case when p_kind = 'intenso' then p_min_level end,
          auth.uid(), now())
  on conflict (student_id) do update
    set kind = excluded.kind, target = excluded.target, min_speed_kmh = excluded.min_speed_kmh,
        min_level = excluded.min_level, set_by = excluded.set_by, updated_at = now();

  v_label := case p_kind
    when 'minutos' then trim(to_char(p_target, 'FM9990.9')) || ' min de cardio por semana'
    when 'distancia' then trim(to_char(p_target, 'FM9990.9')) || ' km de cardio por semana'
    else trim(to_char(p_target, 'FM9990.9')) || ' min de cardio em ritmo forte por semana' end;
  select full_name into v_name from public.profiles where id = auth.uid();
  if p_student <> auth.uid() then
    perform public.notify(p_student, 'Nova meta de cardio 🏃', v_name || ' definiu sua meta: ' || v_label || '.', '/aluno');
  else
    -- O próprio aluno escolheu: avisa os Personais que o acompanham.
    for v_personal in
      select ps.personal_id from public.personal_students ps
       where ps.student_id = p_student and ps.status = 'ativo' and ps.personal_id <> p_student
    loop
      perform public.notify(v_personal, 'Meta de cardio do aluno 🏃', v_name || ' escolheu a própria meta: ' || v_label || '.',
        '/personal/alunos/' || p_student);
    end loop;
  end if;
end;
$$;

-- ─── Fotos 50–59 do catálogo: versão limpa (sem a faixa de título e as bordas do pôster) ──
-- Arquivos novos (-v2) para não pegar a versão antiga guardada no cache do aplicativo.
update public.equipment
   set image_url = replace(image_url, '.webp', '-v2.webp'), image_updated_at = now()
 where image_url ~ '^/catalogo/fotos/5[0-9]-[a-z-]+\.webp$' and image_url !~ '-v2\.webp$';
