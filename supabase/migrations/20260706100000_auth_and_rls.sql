-- ============================================================
-- Ovelhinha — Autenticação real + RLS multi-tenant
-- ============================================================
-- Modelo:
--   staff (admin/reception) → conta Supabase Auth (email+senha) + linha em profiles
--   tia                     → sign-in anônimo + tia_claim(código do dia) → tia_sessions
--   gateway ESP32           → anon key com grants POR COLUNA apenas nas tabelas
--                             do gateway (TRANSITÓRIO até firmware com token próprio)
--
-- Pré-requisito no dashboard: Authentication → Sign In / Up → habilitar
-- "Anonymous sign-ins" (necessário para o fluxo da tia).
-- ============================================================

-- ─── 1. Tabelas de identidade ────────────────────────────────

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  role       text not null check (role in ('admin', 'reception')),
  name       text,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_church on public.profiles(church_id);

create table if not exists public.tia_sessions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  room_id    uuid references public.rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_tia_sessions_church on public.tia_sessions(church_id);

-- Rate-limit de tentativas de código (brute force de 4 dígitos)
create table if not exists public.tia_claim_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_tia_attempts on public.tia_claim_attempts(user_id, attempted_at);

-- ─── 2. Funções auxiliares (security definer p/ evitar recursão de RLS) ──

create or replace function public.current_church_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select church_id from public.profiles where user_id = auth.uid()),
    (select church_id from public.tia_sessions
      where user_id = auth.uid() and expires_at > now())
  )
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where user_id = auth.uid())
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  )
$$;

-- ─── 3. RPC: tia_claim — valida código do dia NO SERVIDOR ────

create or replace function public.tia_claim(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_attempts int;
  v_matches  int;
  v_church_id   uuid;
  v_church_name text;
  v_rooms    jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select count(*) into v_attempts
    from tia_claim_attempts
   where user_id = v_uid and attempted_at > now() - interval '15 minutes';
  if v_attempts >= 8 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into tia_claim_attempts(user_id) values (v_uid);

  select count(*) into v_matches from church_settings where daily_code = p_code;
  if v_matches = 0 then
    raise exception 'INVALID_CODE';
  end if;
  if v_matches > 1 then
    -- colisão de código entre igrejas: recepção deve gerar novo código
    raise exception 'AMBIGUOUS_CODE';
  end if;

  select c.id, c.name into v_church_id, v_church_name
    from churches c
    join church_settings cs on cs.church_id = c.id
   where cs.daily_code = p_code;

  insert into tia_sessions(user_id, church_id, expires_at)
  values (v_uid, v_church_id, now() + interval '12 hours')
  on conflict (user_id) do update
    set church_id = excluded.church_id,
        room_id = null,
        expires_at = excluded.expires_at,
        created_at = now();

  select coalesce(
           jsonb_agg(jsonb_build_object(
             'id', r.id, 'name', r.name, 'emoji', r.emoji, 'ageRange', r.age_range
           ) order by r.created_at),
           '[]'::jsonb)
    into v_rooms
    from rooms r where r.church_id = v_church_id;

  return jsonb_build_object(
    'church_id', v_church_id,
    'church_name', v_church_name,
    'rooms', v_rooms
  );
end
$$;

create or replace function public.tia_set_room(p_room_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_church uuid;
begin
  select church_id into v_church
    from tia_sessions
   where user_id = auth.uid() and expires_at > now();
  if v_church is null then
    raise exception 'NO_TIA_SESSION';
  end if;
  if not exists (select 1 from rooms where id = p_room_id and church_id = v_church) then
    raise exception 'INVALID_ROOM';
  end if;
  update tia_sessions set room_id = p_room_id where user_id = auth.uid();
end
$$;

-- ─── 4. RPC: answer_call com validação de igreja ─────────────

drop function if exists public.answer_call(uuid, text);

create function public.answer_call(p_call_id uuid, p_answered_by text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_call record;
begin
  select * into v_call from calls where id = p_call_id;
  if v_call.id is null then
    raise exception 'CALL_NOT_FOUND';
  end if;
  if v_call.church_id is distinct from public.current_church_id() then
    raise exception 'FORBIDDEN';
  end if;

  update calls
     set status = 'answered', answered_at = now(), answered_by = p_answered_by
   where id = p_call_id;

  update children set status = 'present' where id = v_call.child_id;

  update bracelets
     set status = 'available', guardian_name = null, child_id = null
   where church_id = v_call.church_id and number = v_call.bracelet_number;
end
$$;

-- ─── 5. Liga RLS e remove TODAS as políticas antigas ─────────
-- (as políticas atuais são "USING (true)" para anon — inseguras)

do $$
declare
  t   text;
  pol record;
begin
  foreach t in array array[
    'churches','church_settings','rooms','children','guardians','bracelets',
    'calls','service_history','gateway_commands','gateways','push_subscriptions',
    'profiles','tia_sessions','tia_claim_attempts'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for pol in
        select policyname from pg_policies
         where schemaname = 'public' and tablename = t
      loop
        execute format('drop policy %I on public.%I', pol.policyname, t);
      end loop;
    end if;
  end loop;
end
$$;

-- ─── 6. Políticas para authenticated (staff + tia) ───────────

-- churches: membro lê; staff atualiza (nome etc.)
create policy churches_select on public.churches
  for select to authenticated using (id = public.current_church_id());
create policy churches_update on public.churches
  for update to authenticated
  using (id = public.current_church_id() and public.is_staff());

-- church_settings: SÓ staff (tia não pode ler o código do dia)
create policy settings_staff_all on public.church_settings
  for all to authenticated
  using (church_id = public.current_church_id() and public.is_staff())
  with check (church_id = public.current_church_id() and public.is_staff());

-- rooms: membro lê; staff gerencia
create policy rooms_select on public.rooms
  for select to authenticated using (church_id = public.current_church_id());
create policy rooms_staff_write on public.rooms
  for insert to authenticated
  with check (church_id = public.current_church_id() and public.is_staff());
create policy rooms_staff_update on public.rooms
  for update to authenticated
  using (church_id = public.current_church_id() and public.is_staff());
create policy rooms_staff_delete on public.rooms
  for delete to authenticated
  using (church_id = public.current_church_id() and public.is_staff());

-- children: membro lê e atualiza (tia marca chamado/saída); staff insere/apaga
create policy children_select on public.children
  for select to authenticated using (church_id = public.current_church_id());
create policy children_update on public.children
  for update to authenticated
  using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());
create policy children_staff_insert on public.children
  for insert to authenticated
  with check (church_id = public.current_church_id() and public.is_staff());
create policy children_staff_delete on public.children
  for delete to authenticated
  using (church_id = public.current_church_id() and public.is_staff());

-- guardians: escopo via criança
create policy guardians_select on public.guardians
  for select to authenticated
  using (exists (
    select 1 from public.children c
     where c.id = guardians.child_id and c.church_id = public.current_church_id()
  ));
create policy guardians_staff_write on public.guardians
  for insert to authenticated
  with check (public.is_staff() and exists (
    select 1 from public.children c
     where c.id = guardians.child_id and c.church_id = public.current_church_id()
  ));
create policy guardians_staff_update on public.guardians
  for update to authenticated
  using (public.is_staff() and exists (
    select 1 from public.children c
     where c.id = guardians.child_id and c.church_id = public.current_church_id()
  ));
create policy guardians_staff_delete on public.guardians
  for delete to authenticated
  using (public.is_staff() and exists (
    select 1 from public.children c
     where c.id = guardians.child_id and c.church_id = public.current_church_id()
  ));

-- bracelets: membro lê; staff gerencia
create policy bracelets_select on public.bracelets
  for select to authenticated using (church_id = public.current_church_id());
create policy bracelets_staff_insert on public.bracelets
  for insert to authenticated
  with check (church_id = public.current_church_id() and public.is_staff());
create policy bracelets_staff_update on public.bracelets
  for update to authenticated
  using (church_id = public.current_church_id() and public.is_staff());
create policy bracelets_staff_delete on public.bracelets
  for delete to authenticated
  using (church_id = public.current_church_id() and public.is_staff());

-- calls: membro lê/cria/atualiza; staff apaga (novoCulto)
create policy calls_select on public.calls
  for select to authenticated using (church_id = public.current_church_id());
create policy calls_insert on public.calls
  for insert to authenticated
  with check (church_id = public.current_church_id());
create policy calls_update on public.calls
  for update to authenticated
  using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());
create policy calls_staff_delete on public.calls
  for delete to authenticated
  using (church_id = public.current_church_id() and public.is_staff());

-- service_history: staff
create policy history_staff_all on public.service_history
  for all to authenticated
  using (church_id = public.current_church_id() and public.is_staff())
  with check (church_id = public.current_church_id() and public.is_staff());

-- gateway_commands: membro lê e cria (acionar pulseira); staff atualiza
create policy gw_cmd_select on public.gateway_commands
  for select to authenticated using (church_id = public.current_church_id());
create policy gw_cmd_insert on public.gateway_commands
  for insert to authenticated
  with check (church_id = public.current_church_id());
create policy gw_cmd_staff_update on public.gateway_commands
  for update to authenticated
  using (church_id = public.current_church_id() and public.is_staff());

-- gateways: membro lê; staff gerencia
create policy gateways_select on public.gateways
  for select to authenticated using (church_id = public.current_church_id());
create policy gateways_staff_write on public.gateways
  for insert to authenticated
  with check (church_id = public.current_church_id() and public.is_staff());
create policy gateways_staff_update on public.gateways
  for update to authenticated
  using (church_id = public.current_church_id() and public.is_staff());
create policy gateways_staff_delete on public.gateways
  for delete to authenticated
  using (church_id = public.current_church_id() and public.is_staff());

-- push_subscriptions: membro gerencia inscrições da própria igreja
create policy push_member_all on public.push_subscriptions
  for all to authenticated
  using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());

-- profiles: usuário vê o próprio; staff vê colegas; admin gerencia
create policy profiles_select on public.profiles
  for select to authenticated
  using (user_id = auth.uid()
         or (public.is_staff() and church_id = public.current_church_id()));
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin() and church_id = public.current_church_id());
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin() and church_id = public.current_church_id());
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.is_admin() and church_id = public.current_church_id());

-- tia_sessions: usuário lê a própria sessão (escrita só via RPCs)
create policy tia_sessions_select_own on public.tia_sessions
  for select to authenticated using (user_id = auth.uid());

-- tia_claim_attempts: nenhum acesso direto (só via função definer)

-- ─── 7. Grants ───────────────────────────────────────────────

-- Zera anon: o banco deixa de ser público
revoke all on all tables in schema public from anon;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- TRANSITÓRIO (até firmware com token de gateway):
-- o gateway ESP32 usa a anon key. Grants por coluna + políticas estreitas.
grant select (id, church_id, bracelet_id, command, reason, status, attempts,
              created_at, sent_at, gateway_id, delivered_at)
  on public.gateway_commands to anon;
grant update (status, sent_at, attempts, gateway_id, delivered_at)
  on public.gateway_commands to anon;

grant select (id, church_id, name, last_seen) on public.gateways to anon;
grant insert (church_id, name)                on public.gateways to anon;
grant update (last_seen, name)                on public.gateways to anon;

grant select (id, church_id, number, esp_id)  on public.bracelets to anon;
grant update (last_seen_at, battery)          on public.bracelets to anon;

create policy gw_cmd_anon_select on public.gateway_commands
  for select to anon using (true);
create policy gw_cmd_anon_update on public.gateway_commands
  for update to anon using (true) with check (true);
create policy gateways_anon_select on public.gateways
  for select to anon using (true);
create policy gateways_anon_insert on public.gateways
  for insert to anon with check (true);
create policy gateways_anon_update on public.gateways
  for update to anon using (true) with check (true);
create policy bracelets_anon_select on public.bracelets
  for select to anon using (true);
create policy bracelets_anon_update on public.bracelets
  for update to anon using (true) with check (true);

-- Funções: só authenticated executa
revoke execute on function public.tia_claim(text) from public, anon;
revoke execute on function public.tia_set_room(uuid) from public, anon;
revoke execute on function public.answer_call(uuid, text) from public, anon;
grant execute on function public.tia_claim(text) to authenticated;
grant execute on function public.tia_set_room(uuid) to authenticated;
grant execute on function public.answer_call(uuid, text) to authenticated;
grant execute on function public.current_church_id() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
