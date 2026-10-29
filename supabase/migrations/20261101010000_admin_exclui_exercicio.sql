-- ════════════════════════════════════════════════════════════════
-- Admin exclui exercícios do catálogo
--  • Sem uso (nenhuma ficha nem treino registrado): exclui direto.
--  • Em uso: o admin escolhe um exercício substituto; fichas e treinos registrados passam
--    para ele (o histórico dos alunos continua) e o exercício é excluído.
--  • As execuções (GIF/vídeo) saem junto (cascade); o servidor apaga os arquivos.
-- Só o servidor (service role, depois de conferir que é admin) chama.
-- ════════════════════════════════════════════════════════════════

create function public.admin_delete_equipment(p_equipment uuid, p_replacement uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  v_items int;
  v_sets int;
  v_files text[];
begin
  select * into e from public.equipment where id = p_equipment for update;
  if e.id is null then
    raise exception 'Exercício não encontrado' using errcode = 'P0001';
  end if;
  select count(*) into v_items from public.workout_plan_items where equipment_id = p_equipment;
  select count(*) into v_sets from public.session_sets where equipment_id = p_equipment;

  if v_items + v_sets > 0 then
    if p_replacement is null then
      raise exception 'Exercício em uso: escolha um substituto' using errcode = 'P0001';
    end if;
    if p_replacement = p_equipment or not exists (select 1 from public.equipment where id = p_replacement) then
      raise exception 'Substituto inválido' using errcode = 'P0001';
    end if;
    -- O substituto do item não pode ser igual ao exercício do item.
    update public.workout_plan_items set substitute_equipment_id = null
     where (equipment_id = p_equipment and substitute_equipment_id = p_replacement)
        or (equipment_id = p_replacement and substitute_equipment_id = p_equipment);
    update public.workout_plan_items set equipment_id = p_replacement where equipment_id = p_equipment;
    update public.workout_plan_items set substitute_equipment_id = p_replacement where substitute_equipment_id = p_equipment;
    update public.session_sets set equipment_id = p_replacement where equipment_id = p_equipment;
  end if;

  select coalesce(array_agg(path) filter (where path is not null), '{}') into v_files
    from public.exercise_media where equipment_id = p_equipment;
  delete from public.equipment where id = p_equipment;

  return jsonb_build_object('image_path', e.image_path, 'media_paths', to_jsonb(v_files),
                            'items', v_items, 'sets', v_sets);
end;
$$;
revoke execute on function public.admin_delete_equipment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_equipment(uuid, uuid) to service_role;
