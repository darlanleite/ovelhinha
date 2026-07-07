-- ============================================================
-- Ovelhinha — Sprint 2: Auditoria + Check-out verificado + LGPD
-- ============================================================
-- 1. audit_events: log imutável populado por TRIGGERS (não pelo app)
-- 2. checkout_child(): check-out atômico com verificação do par
--    criança↔pulseira no servidor; tentativa errada vira evento
-- 3. novo_culto(): fechamento de culto atômico (antes eram 4
--    chamadas separadas do cliente)
-- 4. Consentimento LGPD: colunas em children
-- 5. Retenção: anonimização/limpeza automática via pg_cron
-- ============================================================

-- ─── 1. Log de auditoria ─────────────────────────────────────

create table if not exists public.audit_events (
  id         bigint generated always as identity primary key,
  church_id  uuid not null references public.churches(id) on delete cascade,
  actor_id   uuid,               -- auth.uid() de quem causou o evento
  actor_role text not null default 'unknown',
  event_type text not null,
  child_id   uuid,               -- sem FK: o evento sobrevive à criança
  details    jsonb not null default '{}'::jsonb,  -- SEM dados pessoais
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_church_time
  on public.audit_events(church_id, created_at desc);

alter table public.audit_events enable row level security;

-- Staff lê os eventos da própria igreja; NINGUÉM insere/edita/apaga
-- diretamente (só as trigger functions, que rodam como owner)
create policy audit_staff_select on public.audit_events
  for select to authenticated
  using (church_id = public.current_church_id() and public.is_staff());

grant select on public.audit_events to authenticated;
-- (sem grant de insert/update/delete: imutável para a API)

create or replace function public.audit_actor_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where user_id = auth.uid()),
    (select 'tia' from public.tia_sessions
      where user_id = auth.uid() and expires_at > now()),
    case when auth.uid() is null then 'system' else 'unknown' end
  )
$$;

create or replace function public.audit_log(
  p_church uuid, p_type text, p_child uuid, p_details jsonb
) returns void
language sql security definer
set search_path = public
as $$
  insert into public.audit_events (church_id, actor_id, actor_role, event_type, child_id, details)
  values (p_church, auth.uid(), public.audit_actor_role(), p_type, p_child, coalesce(p_details, '{}'::jsonb))
$$;

-- ─── 2. Triggers de auditoria ────────────────────────────────
-- GUC 'ovelhinha.bulk' suprime eventos por linha em operações em
-- massa (novo_culto), que registram um único evento agregado.

create or replace function public.fn_audit_children()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_log(new.church_id, 'check_in', new.id,
      jsonb_build_object('bracelet', new.bracelet_number, 'room_id', new.room_id, 'new_registration', true));
    if new.consent_at is not null then
      perform public.audit_log(new.church_id, 'consent_given', new.id, '{}'::jsonb);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if current_setting('ovelhinha.bulk', true) = '1' then
      return new;
    end if;
    if old.status = 'left' and new.status = 'present' then
      perform public.audit_log(new.church_id, 'check_in', new.id,
        jsonb_build_object('bracelet', new.bracelet_number, 'room_id', new.room_id, 'new_registration', false));
    elsif old.status <> 'left' and new.status = 'left' then
      perform public.audit_log(new.church_id, 'check_out', new.id,
        jsonb_build_object('bracelet', old.bracelet_number));
    end if;
    if old.consent_at is null and new.consent_at is not null then
      perform public.audit_log(new.church_id, 'consent_given', new.id, '{}'::jsonb);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.audit_log(old.church_id, 'child_deleted', old.id, '{}'::jsonb);
    return old;
  end if;
  return null;
end
$$;

drop trigger if exists trg_audit_children on public.children;
create trigger trg_audit_children
  after insert or update or delete on public.children
  for each row execute function public.fn_audit_children();

create or replace function public.fn_audit_calls()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_log(new.church_id, 'call_created', new.child_id,
      jsonb_build_object('reason', new.reason, 'bracelet', new.bracelet_number, 'room_id', new.room_id));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'answered' then
      perform public.audit_log(new.church_id, 'call_answered', new.child_id,
        jsonb_build_object('answered_by', new.answered_by, 'bracelet', new.bracelet_number));
    elsif new.status = 'reactivated' then
      perform public.audit_log(new.church_id, 'call_reactivated', new.child_id,
        jsonb_build_object('bracelet', new.bracelet_number));
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_audit_calls on public.calls;
create trigger trg_audit_calls
  after insert or update on public.calls
  for each row execute function public.fn_audit_calls();

-- ─── 3. Consentimento LGPD ───────────────────────────────────

alter table public.children
  add column if not exists consent_at timestamptz,
  add column if not exists consent_by_name text;

-- ─── 4. Check-out verificado (atômico, com evento de negação) ─

create or replace function public.checkout_child(
  p_child_id uuid, p_bracelet_number text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_child record;
  v_typed text := lpad(trim(p_bracelet_number), 2, '0');
begin
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

  if v_child.bracelet_number is null
     or lpad(trim(v_child.bracelet_number), 2, '0') <> v_typed then
    -- Evento de segurança: alguém tentou retirar a criança com a
    -- pulseira errada. Não revela o número correto.
    perform public.audit_log(v_child.church_id, 'check_out_denied', v_child.id,
      jsonb_build_object('bracelet_typed', v_typed));
    return jsonb_build_object('ok', false, 'error', 'BRACELET_MISMATCH');
  end if;

  update children
     set status = 'left', bracelet_number = null
   where id = p_child_id;  -- trigger registra check_out

  update bracelets
     set status = 'available', guardian_name = null, child_id = null
   where church_id = v_child.church_id
     and number = v_child.bracelet_number;

  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.checkout_child(uuid, text) from public, anon;
grant execute on function public.checkout_child(uuid, text) to authenticated;

-- ─── 5. Novo culto atômico ───────────────────────────────────

create or replace function public.novo_culto()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_church uuid := public.current_church_id();
  v_children int;
  v_calls int;
begin
  if v_church is null or not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into v_children from children where church_id = v_church and status <> 'left';
  select count(*) into v_calls   from calls    where church_id = v_church;

  -- suprime eventos por linha; registra um único evento agregado
  perform set_config('ovelhinha.bulk', '1', true);

  insert into service_history (church_id, service_date, service_name, children_count, calls_count)
  values (v_church, current_date, 'Culto', v_children, v_calls);

  delete from calls where church_id = v_church;

  update bracelets
     set status = 'available', guardian_name = null, child_id = null
   where church_id = v_church and status = 'in-use';

  update children
     set status = 'left', bracelet_number = null
   where church_id = v_church and status <> 'left';

  perform public.audit_log(v_church, 'novo_culto', null,
    jsonb_build_object('children_count', v_children, 'calls_count', v_calls));

  return jsonb_build_object('children_count', v_children, 'calls_count', v_calls);
end
$$;

revoke execute on function public.novo_culto() from public, anon;
grant execute on function public.novo_culto() to authenticated;

-- ─── 6. Retenção LGPD (pg_cron mensal) ───────────────────────
-- 90 dias após a saída: anonimiza notas médicas (redigitáveis no
-- próximo check-in). 365 dias inativo: apaga o cadastro (guardians
-- caem em cascata). Limpezas operacionais junto.

create or replace function public.apply_retention()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_medical int;
  v_deleted int;
begin
  update children set medical_notes = null
   where status = 'left'
     and checked_in_at < now() - interval '90 days'
     and medical_notes is not null;
  get diagnostics v_medical = row_count;

  delete from children
   where status = 'left'
     and checked_in_at < now() - interval '365 days';
  get diagnostics v_deleted = row_count;

  delete from tia_claim_attempts where attempted_at < now() - interval '7 days';
  delete from tia_sessions       where expires_at   < now() - interval '7 days';
  delete from gateway_commands   where created_at   < now() - interval '90 days';
  delete from audit_events       where created_at   < now() - interval '400 days';

  return jsonb_build_object('medical_anonymized', v_medical, 'children_deleted', v_deleted);
end
$$;

do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron indisponível (%). Agende apply_retention() manualmente.', sqlerrm;
end
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ovelhinha-retencao', '0 4 1 * *', 'select public.apply_retention()');
  end if;
end
$$;
