-- Área administrativa: travas de edição do catálogo.
-- As telas do admin usam a service role no servidor, sempre depois de conferir o papel "admin".

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Personal bloqueado pelo admin não cria, edita, exclui nem troca foto de exercícios.
alter table public.profiles add column catalog_blocked boolean not null default false;
-- Exercício travado pelo admin: nenhum Personal edita, exclui ou troca a foto.
alter table public.equipment add column locked boolean not null default false;
-- (Nenhuma das duas colunas entra nos GRANTs de update dos usuários: só o admin, pelo servidor, altera.)

create function public.catalog_blocked() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select catalog_blocked from public.profiles where id = auth.uid()), false)
$$;
revoke execute on function public.catalog_blocked() from public, anon;
grant execute on function public.catalog_blocked() to authenticated;

drop policy "equipamentos: Personal cria os seus" on public.equipment;
drop policy "equipamentos: Personal edita os seus" on public.equipment;
drop policy "equipamentos: Personal exclui os seus" on public.equipment;

create policy "equipamentos: Personal cria os seus" on public.equipment
  for insert to authenticated with check (
    created_by = (select auth.uid()) and not is_default and not locked
    and image_url is null and image_credit is null
    and public.current_role_is('personal')
    and not public.catalog_blocked()
  );
create policy "equipamentos: Personal edita os seus" on public.equipment
  for update to authenticated
  using (created_by = (select auth.uid()) and not is_default and not locked and not public.catalog_blocked())
  with check (created_by = (select auth.uid()) and not is_default and not locked);
create policy "equipamentos: Personal exclui os seus" on public.equipment
  for delete to authenticated
  using (created_by = (select auth.uid()) and not is_default and not locked and not public.catalog_blocked());

create or replace function public.set_equipment_image(p_equipment uuid, p_image_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  v_name text;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais trocam fotos de exercícios' using errcode = '42501';
  end if;
  if public.catalog_blocked() then
    raise exception 'Sua conta está sem permissão para editar exercícios. Fale com o administrador.' using errcode = '42501';
  end if;
  select * into e from public.equipment where id = p_equipment for update;
  if not found or not (e.is_default or e.created_by = auth.uid()) then
    raise exception 'Exercício não encontrado' using errcode = 'P0001';
  end if;
  if e.locked then
    raise exception 'Este exercício foi travado pelo administrador.' using errcode = '42501';
  end if;
  if p_image_path is not null and p_image_path not like auth.uid()::text || '/%' then
    raise exception 'Imagem inválida' using errcode = 'P0001';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  update public.equipment
    set image_path = p_image_path,
        image_updated_by = case when p_image_path is null then null else auth.uid() end,
        image_updated_at = now(),
        image_credit = case
          when not e.is_default then e.image_credit
          when p_image_path is null then 'Ilustração própria BoraTreinar (licença MIT)'
          else 'Foto enviada por ' || v_name
        end
    where id = p_equipment;
end;
$$;
