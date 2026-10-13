-- ════════════════════════════════════════════════════════════════
-- Foto de perfil (Personais e alunos) + Financeiro do Personal
-- ════════════════════════════════════════════════════════════════

-- ─── Foto de perfil ────────────────────────────────────────────
-- Caminho no bucket "avatars": <id do usuário>/<uuid>.webp|jpg
alter table public.profiles
  add column avatar_path text check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$');
grant update (avatar_path) on public.profiles to authenticated;

-- O próprio usuário só aponta para um arquivo da própria pasta.
create function public.check_avatar_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.avatar_path is not null and split_part(new.avatar_path, '/', 1) <> new.id::text then
    raise exception 'Foto inválida' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger profiles_avatar_owner before insert or update of avatar_path on public.profiles
  for each row execute function public.check_avatar_owner();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "avatars: envia na própria pasta" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "avatars: dono atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: dono exclui" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);

-- ─── Financeiro ────────────────────────────────────────────────
-- Pacotes do Personal: "por aula" (valor de cada aula) ou "mensal" (N aulas por semana).
create table public.payment_packages (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  kind text not null check (kind in ('por_aula', 'mensal')),
  classes_per_week smallint check (classes_per_week between 1 and 7),
  price numeric(10, 2) not null check (price > 0 and price < 100000),
  created_at timestamptz not null default now(),
  check ((kind = 'mensal') = (classes_per_week is not null))
);
create index payment_packages_personal_idx on public.payment_packages (personal_id);

-- Plano de cada aluno com o Personal: valor (mensal ou por aula) e dia do pagamento.
create table public.student_billing (
  personal_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  package_id uuid references public.payment_packages (id) on delete set null,
  label text not null check (char_length(label) between 1 and 60),
  kind text not null check (kind in ('por_aula', 'mensal')),
  amount numeric(10, 2) not null check (amount > 0 and amount < 100000),
  due_day smallint not null check (due_day between 1 and 31),
  starts_on date not null,
  updated_at timestamptz not null default now(),
  primary key (personal_id, student_id)
);
create index student_billing_student_idx on public.student_billing (student_id);

-- Cobrança do mês (uma por aluno e mês). Gerada a partir do plano.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  description text not null,
  amount numeric(10, 2) not null check (amount >= 0 and amount < 1000000),
  classes int,
  due_on date not null,
  paid_at timestamptz,
  last_reminder_on date,
  created_at timestamptz not null default now(),
  unique (personal_id, student_id, month)
);
create index payments_personal_month_idx on public.payments (personal_id, month);
create index payments_student_idx on public.payments (student_id, month desc);

alter table public.payment_packages enable row level security;
alter table public.student_billing enable row level security;
alter table public.payments enable row level security;
revoke all on public.payment_packages, public.student_billing, public.payments from anon;
revoke insert, update, delete, truncate on public.student_billing, public.payments from authenticated;

create policy "pacotes: Personal gerencia os seus" on public.payment_packages
  for all to authenticated
  using (personal_id = (select auth.uid()))
  with check (personal_id = (select auth.uid()) and public.current_role_is('personal'));
create policy "plano: Personal vê os seus" on public.student_billing
  for select to authenticated using (personal_id = (select auth.uid()));
create policy "plano: aluno vê o próprio" on public.student_billing
  for select to authenticated using (student_id = (select auth.uid()));
create policy "cobranças: Personal vê as suas" on public.payments
  for select to authenticated using (personal_id = (select auth.uid()));
create policy "cobranças: aluno vê as próprias" on public.payments
  for select to authenticated using (student_id = (select auth.uid()));

/** Valor em reais: 1234.5 → "R$ 1234,50". */
create function private.brl(p numeric) returns text
language sql immutable set search_path = '' as $$
  select 'R$ ' || replace(to_char(p, 'FM999999990.00'), '.', ',');
$$;

/** Aulas (não canceladas) de um aluno com um Personal num mês. */
create function private.classes_in_month(p_personal uuid, p_student uuid, p_month date) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from generate_series(p_month, (p_month + interval '1 month' - interval '1 day')::date, interval '1 day') g(d)
    join public.class_schedules s
      on s.personal_id = p_personal and s.student_id = p_student
     and s.weekday = extract(dow from g.d)::smallint
     and s.starts_on <= g.d::date and (s.ends_on is null or s.ends_on >= g.d::date)
   where not exists (select 1 from public.class_exceptions e where e.schedule_id = s.id and e.on_date = g.d::date);
$$;

/** Cria as cobranças do mês que faltam para os alunos ativos com plano. Retorna quantas criou. */
create function private.generate_charges(p_personal uuid, p_month date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_last int := extract(day from (date_trunc('month', p_month) + interval '1 month' - interval '1 day'))::int;
  v_count int;
begin
  insert into public.payments (personal_id, student_id, month, description, amount, classes, due_on)
  select b.personal_id, b.student_id, v_month,
         case when b.kind = 'por_aula' then b.label || ' · ' || c.n || case when c.n = 1 then ' aula' else ' aulas' end
              else b.label end,
         case when b.kind = 'por_aula' then b.amount * c.n else b.amount end,
         c.n,
         v_month + (least(b.due_day, v_last) - 1)
    from public.student_billing b
    join public.personal_students ps
      on ps.personal_id = b.personal_id and ps.student_id = b.student_id
     and ps.status = 'ativo' and ps.archived_at is null
    cross join lateral (select private.classes_in_month(b.personal_id, b.student_id, v_month) as n) c
   where b.personal_id = p_personal
     and b.starts_on < v_month + interval '1 month'
  on conflict (personal_id, student_id, month) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function private.classes_in_month(uuid, uuid, date), private.generate_charges(uuid, date),
  private.brl(numeric) from public, anon, authenticated;

/** O Personal abre o financeiro de um mês: cria as cobranças que faltam (até o mês que vem). */
create function public.ensure_month_charges(p_month date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_now date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais' using errcode = '42501';
  end if;
  if date_trunc('month', p_month)::date > (v_now + interval '1 month')::date then
    return 0;
  end if;
  return private.generate_charges(auth.uid(), p_month);
end;
$$;

/**
 * Define (ou troca) o plano de um aluno. Se a cobrança do mês atual ainda não foi paga,
 * ela é refeita com o novo valor.
 */
create function public.set_student_billing(p_student uuid, p_package uuid, p_label text, p_kind text,
                                           p_amount numeric, p_due_day int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  pk public.payment_packages;
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_redo date;
begin
  if not public.current_role_is('personal') or not public.is_linked_personal(p_student) then
    raise exception 'Você não acompanha esse aluno' using errcode = '42501';
  end if;
  if p_package is not null then
    select * into pk from public.payment_packages where id = p_package and personal_id = auth.uid();
    if pk.id is null then
      raise exception 'Pacote não encontrado' using errcode = 'P0001';
    end if;
  end if;
  if pk.id is null and (p_kind is null or p_kind not in ('por_aula', 'mensal') or p_amount is null) then
    raise exception 'Escolha um pacote ou informe o valor' using errcode = 'P0001';
  end if;
  if p_due_day is null or p_due_day not between 1 and 31 then
    raise exception 'Escolha o dia do pagamento (1 a 31)' using errcode = 'P0001';
  end if;

  insert into public.student_billing (personal_id, student_id, package_id, label, kind, amount, due_day, starts_on)
  values (auth.uid(), p_student, pk.id,
          coalesce(nullif(trim(p_label), ''), pk.name, 'Aulas'),
          coalesce(pk.kind, p_kind),
          coalesce(p_amount, pk.price),
          p_due_day, v_month)
  on conflict (personal_id, student_id) do update
    set package_id = excluded.package_id, label = excluded.label, kind = excluded.kind,
        amount = excluded.amount, due_day = excluded.due_day, updated_at = now();

  -- Refaz as cobranças em aberto (mês atual e, se já existir, o próximo).
  for v_redo in
    with d as (
      delete from public.payments
       where personal_id = auth.uid() and student_id = p_student and month >= v_month and paid_at is null
      returning month
    )
    select v_month union select month from d
  loop
    perform private.generate_charges(auth.uid(), v_redo);
  end loop;
end;
$$;

/** Tira o plano do aluno (e as cobranças em aberto do mês atual em diante). */
create function public.remove_student_billing(p_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais' using errcode = '42501';
  end if;
  delete from public.student_billing where personal_id = auth.uid() and student_id = p_student;
  delete from public.payments
   where personal_id = auth.uid() and student_id = p_student and paid_at is null
     and month >= date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
end;
$$;

/** Marca/desmarca uma cobrança como paga. Ao marcar, avisa o aluno. */
create function public.set_payment_paid(p_payment uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  v_personal text;
begin
  select * into p from public.payments where id = p_payment and personal_id = auth.uid();
  if p.id is null then
    raise exception 'Cobrança não encontrada' using errcode = '42501';
  end if;
  update public.payments set paid_at = case when p_paid then coalesce(paid_at, now()) end where id = p.id;
  if p_paid and p.paid_at is null then
    select full_name into v_personal from public.profiles where id = p.personal_id;
    perform public.notify(p.student_id, 'Pagamento confirmado ✅',
      v_personal || ' confirmou o pagamento de ' || private.brl(p.amount)
        || ' (' || to_char(p.month, 'MM/YYYY') || ').',
      '/aluno/aulas');
  end if;
end;
$$;

/** Ajusta o valor de uma cobrança em aberto (ex.: aulas extras ou desconto). */
create function public.set_payment_amount(p_payment uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_amount is null or p_amount < 0 or p_amount >= 1000000 then
    raise exception 'Valor inválido' using errcode = 'P0001';
  end if;
  update public.payments set amount = p_amount
   where id = p_payment and personal_id = auth.uid() and paid_at is null;
  if not found then
    raise exception 'Cobrança não encontrada ou já paga' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.ensure_month_charges(date),
  public.set_student_billing(uuid, uuid, text, text, numeric, int),
  public.remove_student_billing(uuid),
  public.set_payment_paid(uuid, boolean),
  public.set_payment_amount(uuid, numeric) from public, anon;
grant execute on function public.ensure_month_charges(date),
  public.set_student_billing(uuid, uuid, text, text, numeric, int),
  public.remove_student_billing(uuid),
  public.set_payment_paid(uuid, boolean),
  public.set_payment_amount(uuid, numeric) to authenticated;

/**
 * Lembretes de pagamento (cron diário, 7h): avisa o aluno 1 dia antes, no dia e no dia
 * seguinte ao vencimento; no dia seguinte também avisa o Personal. Gera antes as cobranças
 * do mês. Idempotente por dia (last_reminder_on). Retorna quantos avisos criou.
 */
create function public.payment_reminders(p_date date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_count int := 0;
  v_value text;
begin
  perform private.generate_charges(b.personal_id, p_date)
     from (select distinct personal_id from public.student_billing) b;
  -- Na virada do mês o vencimento de amanhã pode cair no mês seguinte.
  if extract(month from p_date + 1) <> extract(month from p_date) then
    perform private.generate_charges(b.personal_id, p_date + 1)
       from (select distinct personal_id from public.student_billing) b;
  end if;

  for r in
    select p.*, pp.full_name as personal_name, st.full_name as student_name
      from public.payments p
      join public.profiles pp on pp.id = p.personal_id
      join public.profiles st on st.id = p.student_id
     where p.paid_at is null and p.amount > 0
       and p.due_on between p_date - 1 and p_date + 1
       and p.last_reminder_on is distinct from p_date
  loop
    v_value := private.brl(r.amount);
    if r.due_on = p_date + 1 then
      perform public.notify(r.student_id, 'Pagamento vence amanhã 💸',
        'Lembrete: ' || v_value || ' para ' || r.personal_name || ' vence amanhã (' || to_char(r.due_on, 'DD/MM') || ').',
        '/aluno/aulas');
    elsif r.due_on = p_date then
      perform public.notify(r.student_id, 'Hoje é dia de pagar 💸',
        v_value || ' para ' || r.personal_name || ' vence hoje.', '/aluno/aulas');
    else
      perform public.notify(r.student_id, 'Pagamento pendente',
        v_value || ' para ' || r.personal_name || ' venceu ontem (' || to_char(r.due_on, 'DD/MM') || ').', '/aluno/aulas');
      perform public.notify(r.personal_id, '💸 ' || split_part(r.student_name, ' ', 1) || ' ainda não pagou',
        v_value || ' venceu ontem (' || to_char(r.due_on, 'DD/MM') || ').',
        '/personal/financeiro?mes=' || to_char(r.month, 'YYYY-MM'));
    end if;
    update public.payments set last_reminder_on = p_date where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.payment_reminders(date) from public, anon, authenticated;
grant execute on function public.payment_reminders(date) to service_role;
