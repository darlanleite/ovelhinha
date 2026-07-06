-- ============================================================
-- Ovelhinha — Schema base completo
-- ============================================================
-- Reconstrói do zero todo o schema que existia no projeto original
-- (montado à época via SQL Editor). Idempotente: roda com segurança
-- em banco novo ou existente. Deve ser a PRIMEIRA migração (nome
-- 20260101... ordena antes das demais).
-- ============================================================

-- ─── Igreja e configurações ──────────────────────────────────

create table if not exists public.churches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.church_settings (
  church_id          uuid primary key references public.churches(id) on delete cascade,
  daily_code         text not null default '0000',
  reactivate_minutes integer not null default 5
);

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  name       text not null,
  emoji      text not null default '📚',
  age_range  text not null default '',
  created_at timestamptz not null default now()
);

-- ─── Crianças e responsáveis ─────────────────────────────────
-- room_id sem FK de propósito: salas podem ser removidas a qualquer
-- momento sem travar em cadastros históricos (status left persiste
-- entre cultos para o check-in recorrente).

create table if not exists public.children (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null references public.churches(id) on delete cascade,
  name              text not null,
  birth_date        date not null,
  room_id           uuid not null,
  medical_notes     text,
  bracelet_number   text,
  authorized_pickup text,
  status            text not null default 'present'
                      check (status in ('present', 'called', 'left')),
  checked_in_at     timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_children_church_status
  on public.children(church_id, status);

create table if not exists public.guardians (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.children(id) on delete cascade,
  name       text not null,
  phone      text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_guardians_child on public.guardians(child_id);

-- ─── Pulseiras ───────────────────────────────────────────────

create table if not exists public.bracelets (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  number          text not null,
  esp_id          text,
  status          text not null default 'available'
                    check (status in ('available', 'in-use', 'charging', 'offline')),
  battery         integer not null default 100,
  guardian_name   text,
  child_id        uuid references public.children(id) on delete set null,
  last_seen_at    timestamptz,
  last_gateway_id uuid,
  created_at      timestamptz not null default now(),
  unique (church_id, number)
);

-- ─── Chamadas ────────────────────────────────────────────────

create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  child_id        uuid not null references public.children(id) on delete cascade,
  bracelet_number text not null,
  room_id         uuid not null,
  reason          text not null,
  reason_icon     text not null default '📝',
  status          text not null default 'open'
                    check (status in ('open', 'answered', 'reactivated')),
  answered_by     text check (answered_by in ('reception', 'tia')),
  created_at      timestamptz not null default now(),
  answered_at     timestamptz
);

create index if not exists idx_calls_church_status
  on public.calls(church_id, status);

-- ─── Histórico de cultos ─────────────────────────────────────

create table if not exists public.service_history (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid not null references public.churches(id) on delete cascade,
  service_date   date not null,
  service_name   text not null default 'Culto',
  children_count integer not null default 0,
  calls_count    integer not null default 0,
  created_at     timestamptz not null default now()
);

-- ─── Gateway BLE (fila de comandos + registro) ───────────────

create table if not exists public.gateways (
  id        uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name      text not null default 'Gateway-01',
  last_seen timestamptz
);

create index if not exists idx_gateways_church on public.gateways(church_id);

create table if not exists public.gateway_commands (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches(id) on delete cascade,
  bracelet_id  uuid not null references public.bracelets(id) on delete cascade,
  command      text not null check (command in ('acionar', 'encerrar')),
  reason       text,
  status       text not null default 'pending'
                 check (status in ('pending', 'sent', 'failed')),
  attempts     integer not null default 0,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  gateway_id   uuid references public.gateways(id),
  delivered_at timestamptz
);

create index if not exists idx_gw_commands_pending
  on public.gateway_commands(church_id, status, created_at)
  where status = 'pending';

-- ─── Push notifications ──────────────────────────────────────
-- device_id único: o upsert do frontend usa onConflict: 'device_id'

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  device_id  text not null unique,
  role       text not null check (role in ('reception', 'tia')),
  room_id    uuid,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─── Realtime ────────────────────────────────────────────────
-- Os hooks do frontend assinam postgres_changes nessas tabelas.
-- REPLICA IDENTITY FULL para que DELETEs (ex.: novoCulto apaga calls)
-- carreguem church_id e passem no filtro do canal.

alter table public.children  replica identity full;
alter table public.calls     replica identity full;
alter table public.bracelets replica identity full;
alter table public.guardians replica identity full;

do $$
declare t text;
begin
  foreach t in array array['children', 'calls', 'bracelets', 'guardians'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- já estava na publication
    end;
  end loop;
end
$$;

-- ─── Seed: igreja padrão ─────────────────────────────────────
-- Mantém o MESMO uuid da igreja original: o firmware dos gateways
-- tem CHURCH_ID hardcoded — assim só URL/key precisam mudar no .ino.

insert into public.churches (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Minha Igreja', 'ovelhinha')
on conflict (id) do nothing;

insert into public.church_settings (church_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (church_id) do nothing;

-- Salas iniciais (só se a igreja ainda não tiver nenhuma)
insert into public.rooms (church_id, name, emoji, age_range)
select '00000000-0000-0000-0000-000000000001', r.name, r.emoji, r.age_range
from (values
  ('Berçário', '👶', '0-2 anos'),
  ('Maternal', '🧸', '3-5 anos'),
  ('Juniores', '📚', '6-9 anos')
) as r(name, emoji, age_range)
where not exists (
  select 1 from public.rooms
  where church_id = '00000000-0000-0000-0000-000000000001'
);

-- Pulseiras 01–10 (só se ainda não houver nenhuma)
insert into public.bracelets (church_id, number)
select '00000000-0000-0000-0000-000000000001', lpad(n::text, 2, '0')
from generate_series(1, 10) as n
where not exists (
  select 1 from public.bracelets
  where church_id = '00000000-0000-0000-0000-000000000001'
);
