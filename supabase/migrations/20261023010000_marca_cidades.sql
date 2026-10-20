-- ════════════════════════════════════════════════════════════════
-- Marca do Personal (Premium em teste) e cidades de atendimento
--  • logo_path: logo do Personal (bucket avatars, pasta do Personal). Os alunos dele veem o
--    logo no topo do app.
--  • service_cities: cidades onde o Personal atende (códigos IBGE; por enquanto só RS).
--    A vitrine de Personais pode ser filtrada pela cidade do aluno.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles
  add column logo_path text check (char_length(logo_path) <= 200),
  add column service_cities int[] not null default '{}'
    check (cardinality(service_cities) <= 100 and 4300000 <= all (service_cities) and 4399999 >= all (service_cities));
grant update (logo_path, service_cities) on public.profiles to authenticated;

/**
 * Logo do Personal responsável pelo aluno (ou de outro Personal ativo dele que tenha logo).
 * Só lê o logo de quem acompanha o aluno logado.
 */
create function public.my_personal_logo()
returns table (personal_id uuid, full_name text, logo_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.logo_path
    from public.personal_students ps
    join public.profiles p on p.id = ps.personal_id
   where ps.student_id = auth.uid() and ps.status = 'ativo' and ps.personal_id <> auth.uid()
     and p.logo_path is not null
   order by (ps.role = 'responsavel') desc, ps.created_at
   limit 1;
$$;
revoke execute on function public.my_personal_logo() from public, anon;
grant execute on function public.my_personal_logo() to authenticated;

-- Vitrine: agora com as cidades de atendimento e filtro opcional pela cidade do aluno.
drop function public.personal_directory();
create function public.personal_directory(p_city int default null)
returns table (id uuid, full_name text, avatar_path text, age int, phone text, packages jsonb, min_class_price numeric,
               cities int[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.avatar_path,
         case when p.birth_date is not null
              then extract(year from age((now() at time zone 'America/Sao_Paulo')::date, p.birth_date))::int end,
         p.phone,
         coalesce((select jsonb_agg(jsonb_build_object('name', k.name, 'kind', k.kind,
                                                       'classes_per_week', k.classes_per_week, 'price', k.price)
                                    order by k.kind desc, k.price)
                     from public.payment_packages k where k.personal_id = p.id), '[]'::jsonb),
         (select min(case when k.kind = 'por_aula' then k.price
                          else round(k.price / (k.classes_per_week * 52.0 / 12), 2) end)
            from public.payment_packages k where k.personal_id = p.id),
         p.service_cities
    from public.profiles p
   where p.role = 'personal' and p.directory_listed and p.phone is not null
     and auth.uid() is not null
     and (p_city is null or p_city = any (p.service_cities))
   order by p.full_name;
$$;
revoke execute on function public.personal_directory(int) from public, anon;
grant execute on function public.personal_directory(int) to authenticated;
