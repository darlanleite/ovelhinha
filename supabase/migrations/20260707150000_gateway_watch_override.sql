-- ============================================================
-- Ovelhinha — Vigia de gateway offline + retirada por terceiro
-- ============================================================
-- 1. check_gateways_offline(): roda a cada minuto via pg_cron;
--    quando um gateway fica >2min sem heartbeat, registra evento
--    de auditoria e dispara push para a recepção via pg_net →
--    edge function notify-call (autenticada com a service key
--    guardada no Vault). Anti-spam: 1 alerta por queda.
-- 2. checkout_override(): saída SEM a pulseira (perda/terceiro
--    autorizado) — só staff, sempre auditada.
-- ============================================================

-- ─── 1. Vigia de gateways ────────────────────────────────────

alter table public.gateways
  add column if not exists offline_alerted_at timestamptz;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponível (%). Push de gateway offline desabilitado.', sqlerrm;
end
$$;

-- Guarda segredos no Vault sem expô-los em migração/repositório.
-- Só o service_role executa (usado uma vez no setup, via REST).
create or replace function public.internal_set_secret(p_name text, p_value text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name);
  else
    perform vault.update_secret(v_id, p_value);
  end if;
end
$$;

revoke execute on function public.internal_set_secret(text, text) from public, anon, authenticated;
grant execute on function public.internal_set_secret(text, text) to service_role;

create or replace function public.check_gateways_offline()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  gw record;
  v_key text;
begin
  -- service key fica no Vault (não hardcoded na função)
  begin
    select decrypted_secret into v_key
      from vault.decrypted_secrets
     where name = 'service_role_key'
     limit 1;
  exception when others then
    v_key := null;
  end;

  for gw in
    select g.id, g.church_id, g.name, g.last_seen
      from gateways g
     where g.last_seen is not null
       and g.last_seen < now() - interval '2 minutes'
       and (g.offline_alerted_at is null or g.offline_alerted_at < g.last_seen)
  loop
    update gateways set offline_alerted_at = now() where id = gw.id;

    insert into audit_events (church_id, actor_role, event_type, details)
    values (gw.church_id, 'system', 'gateway_offline',
            jsonb_build_object('gateway', gw.name, 'last_seen', gw.last_seen));

    if v_key is not null then
      perform net.http_post(
        url     := 'https://gxdmwpebrrjmqqkekzwu.supabase.co/functions/v1/notify-call',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body    := jsonb_build_object(
          'church_id', gw.church_id,
          'type', 'gateway_offline',
          'gateway_name', gw.name
        )
      );
    end if;
  end loop;
end
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ovelhinha-gateway-watch', '* * * * *',
      'select public.check_gateways_offline()');
  end if;
end
$$;

-- ─── 2. Retirada sem pulseira (override auditado, só staff) ──

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

  -- suprime o check_out genérico do trigger; registra o override completo
  perform set_config('ovelhinha.bulk', '1', true);

  update children
     set status = 'left', bracelet_number = null
   where id = p_child_id;

  if v_child.bracelet_number is not null then
    update bracelets
       set status = 'available', guardian_name = null, child_id = null
     where church_id = v_child.church_id
       and number = v_child.bracelet_number;
  end if;

  perform public.audit_log(v_child.church_id, 'check_out_override', v_child.id,
    jsonb_build_object(
      'picked_by', trim(p_picked_by),
      'reason', coalesce(p_reason, ''),
      'bracelet', v_child.bracelet_number
    ));

  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.checkout_override(uuid, text, text) from public, anon;
grant execute on function public.checkout_override(uuid, text, text) to authenticated;
