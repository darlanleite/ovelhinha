-- ============================================================
-- Pulseira extraviada: na saída SEM pulseira, a unidade física
-- ficou com o responsável — não pode voltar para 'available'
-- (a recepção tentaria entregá-la no próximo culto). Vira
-- 'missing' até alguém marcá-la como devolvida em Pulseiras.
-- ============================================================

alter table public.bracelets drop constraint if exists bracelets_status_check;
alter table public.bracelets add constraint bracelets_status_check
  check (status in ('available', 'in-use', 'charging', 'offline', 'missing'));

create or replace function public.checkout_override(
  p_child_id uuid, p_picked_by text, p_reason text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_child record;
begin
  if not public.is_staff() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  select * into v_child from children where id = p_child_id;
  if v_child.id is null then
    return jsonb_build_object('ok', false, 'error', 'CHILD_NOT_FOUND');
  end if;
  if v_child.church_id is distinct from public.current_church_id() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if v_child.status = 'left' then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_OUT');
  end if;
  if coalesce(trim(p_picked_by), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'PICKED_BY_REQUIRED');
  end if;

  perform set_config('ovelhinha.bulk', '1', true);

  update children
     set status = 'left', bracelet_number = null
   where id = p_child_id;

  -- Pulseira física NÃO foi devolvida: sai de circulação
  if v_child.bracelet_number is not null then
    update bracelets
       set status = 'missing', child_id = null
       -- guardian_name preservado: ajuda a recepção a cobrar a devolução
     where church_id = v_child.church_id
       and number = v_child.bracelet_number;
  end if;

  perform public.audit_log(v_child.church_id, 'check_out_override', v_child.id,
    jsonb_build_object(
      'picked_by', trim(p_picked_by),
      'reason', coalesce(p_reason, ''),
      'bracelet', v_child.bracelet_number,
      'bracelet_marked_missing', v_child.bracelet_number is not null
    ));

  return jsonb_build_object('ok', true);
end
$$;
