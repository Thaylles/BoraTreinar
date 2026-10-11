-- ════════════════════════════════════════════════════════════════
-- Foto única para os exercícios do catálogo padrão
-- Qualquer Personal pode trocar (ou remover) a foto de um exercício padrão;
-- a troca vale para todos e fica registrado quem enviou.
-- ════════════════════════════════════════════════════════════════

alter table public.equipment
  add column image_updated_by uuid references public.profiles (id) on delete set null,
  add column image_updated_at timestamptz;

/**
 * Troca a foto de um exercício padrão (ou de um exercício próprio).
 * p_image_path: caminho no bucket "equipment" dentro da pasta do próprio Personal,
 * ou null para voltar à ilustração original.
 */
create function public.set_equipment_image(p_equipment uuid, p_image_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  v_name text;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais trocam fotos de exercícios' using errcode = '42501';
  end if;
  select * into e from public.equipment where id = p_equipment for update;
  if not found or not (e.is_default or e.created_by = auth.uid()) then
    raise exception 'Exercício não encontrado' using errcode = 'P0001';
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
revoke execute on function public.set_equipment_image(uuid, text) from public, anon;
grant execute on function public.set_equipment_image(uuid, text) to authenticated;
