-- ════════════════════════════════════════════════════════════════
-- Pix (nível 1) e comentários no treino
--  • O Personal cadastra a chave Pix (e, opcional, um link de pagamento). O app gera o
--    "Pix copia e cola"/QR Code com o valor da cobrança; o aluno avisa "Já paguei" e o
--    Personal confirma (ou responde que não recebeu).
--  • Personal e aluno conversam sobre cada treino feito (comentários).
-- ════════════════════════════════════════════════════════════════

-- ─── Pix do Personal ────────────────────────────────────────────
create table public.pix_settings (
  personal_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  key_type text not null check (key_type in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_key text not null check (char_length(pix_key) between 1 and 77),
  holder_name text not null check (char_length(trim(holder_name)) between 1 and 60),
  city text not null check (char_length(trim(city)) between 1 and 40),
  payment_link text check (payment_link ~ '^https://' and char_length(payment_link) <= 300),
  updated_at timestamptz not null default now()
);

alter table public.pix_settings enable row level security;
revoke all on public.pix_settings from anon;
create policy "pix: Personal gerencia o seu" on public.pix_settings
  for all to authenticated
  using (personal_id = (select auth.uid()))
  with check (personal_id = (select auth.uid()) and public.current_role_is('personal'));
create policy "pix: alunos vinculados leem" on public.pix_settings
  for select to authenticated
  using (exists (select 1 from public.personal_students ps
                  where ps.personal_id = pix_settings.personal_id
                    and ps.student_id = (select auth.uid()) and ps.status = 'ativo'));

-- Aluno avisou que pagou (o Personal ainda confirma).
alter table public.payments add column reported_paid_at timestamptz;

/** O aluno avisa o Personal que já pagou a cobrança. */
create function public.report_payment(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  v_student text;
begin
  select * into p from public.payments where id = p_payment and student_id = auth.uid();
  if p.id is null then
    raise exception 'Cobrança não encontrada' using errcode = '42501';
  end if;
  if p.paid_at is not null or p.reported_paid_at is not null then
    return;
  end if;
  update public.payments set reported_paid_at = now() where id = p.id;
  select full_name into v_student from public.profiles where id = p.student_id;
  perform public.notify(p.personal_id, '💸 ' || split_part(v_student, ' ', 1) || ' avisou que pagou',
    private.brl(p.amount) || ' (' || p.description || '). Confira e confirme o recebimento.',
    '/personal/financeiro?mes=' || to_char(p.month, 'YYYY-MM'));
end;
$$;

/** O Personal não encontrou o pagamento avisado: volta para "em aberto" e avisa o aluno. */
create function public.reject_payment_report(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  v_personal text;
begin
  select * into p from public.payments where id = p_payment and personal_id = auth.uid();
  if p.id is null then
    raise exception 'Cobrança não encontrada' using errcode = '42501';
  end if;
  if p.reported_paid_at is null or p.paid_at is not null then
    return;
  end if;
  update public.payments set reported_paid_at = null where id = p.id;
  select full_name into v_personal from public.profiles where id = p.personal_id;
  perform public.notify(p.student_id, 'Pagamento não identificado',
    v_personal || ' ainda não encontrou o pagamento de ' || private.brl(p.amount) || '. Confira o comprovante e fale com seu Personal.',
    '/aluno/aulas');
end;
$$;

revoke execute on function public.report_payment(uuid), public.reject_payment_report(uuid) from public, anon;
grant execute on function public.report_payment(uuid), public.reject_payment_report(uuid) to authenticated;

-- Lembretes: não cobra quem já avisou que pagou.
do $$
declare
  src text := pg_get_functiondef('public.payment_reminders(date)'::regprocedure);
  dst text;
begin
  dst := replace(src, 'where p.paid_at is null and p.amount > 0', 'where p.paid_at is null and p.reported_paid_at is null and p.amount > 0');
  if dst = src then
    raise exception 'payment_reminders: trecho esperado não encontrado';
  end if;
  execute dst;
end $$;

-- ─── Comentários no treino ──────────────────────────────────────
create table public.session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index session_comments_session_idx on public.session_comments (session_id, created_at);

alter table public.session_comments enable row level security;
revoke all on public.session_comments from anon;
revoke insert, update, truncate on public.session_comments from authenticated;
create policy "comentários: aluno e Personais vinculados leem" on public.session_comments
  for select to authenticated
  using (exists (select 1 from public.workout_sessions ws
                  where ws.id = session_id
                    and (ws.student_id = (select auth.uid()) or public.is_linked_personal(ws.student_id))));
create policy "comentários: autor apaga o seu" on public.session_comments
  for delete to authenticated using (author_id = (select auth.uid()));

/** Comenta um treino: o aluno dono ou um Personal vinculado. Avisa o outro lado. */
create function public.add_session_comment(p_session uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  ws public.workout_sessions;
  v_name text;
  v_id uuid;
  v_text text := trim(p_body);
begin
  select * into ws from public.workout_sessions where id = p_session;
  if ws.id is null or (ws.student_id <> v_me and not public.is_linked_personal(ws.student_id)) then
    raise exception 'Treino não encontrado' using errcode = '42501';
  end if;
  if char_length(coalesce(v_text, '')) not between 1 and 1000 then
    raise exception 'Escreva um comentário de até 1000 caracteres' using errcode = 'P0001';
  end if;
  insert into public.session_comments (session_id, author_id, body) values (p_session, v_me, v_text) returning id into v_id;

  select full_name into v_name from public.profiles where id = v_me;
  v_text := case when char_length(v_text) > 120 then left(v_text, 117) || '…' else v_text end;
  if v_me = ws.student_id then
    perform public.notify(ps.personal_id, '💬 ' || split_part(v_name, ' ', 1) || ' comentou o treino', v_text,
                          '/personal/treinos/' || p_session)
       from public.personal_students ps
      where ps.student_id = ws.student_id and ps.status = 'ativo' and ps.personal_id <> v_me;
  else
    perform public.notify(ws.student_id, '💬 ' || split_part(v_name, ' ', 1) || ' comentou seu treino', v_text,
                          '/aluno/historico/' || p_session);
  end if;
  return v_id;
end;
$$;
revoke execute on function public.add_session_comment(uuid, text) from public, anon;
grant execute on function public.add_session_comment(uuid, text) to authenticated;
