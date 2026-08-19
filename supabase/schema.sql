-- =========================================================================
-- Liga de Golf - esquema de base de datos para Supabase (Postgres)
-- =========================================================================
-- Cómo usar este archivo:
--   1. Crea un proyecto gratuito en https://supabase.com
--   2. Ve a "SQL Editor" -> "New query"
--   3. Pega TODO este archivo y pulsa "Run"
-- Ver README.md para el resto de pasos (variables de entorno, primer admin, etc).
-- =========================================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- Tipos
-- -------------------------------------------------------------------------
do $$ begin
  create type app_role as enum ('admin', 'player');
exception when duplicate_object then null; end $$;

do $$ begin
  create type player_status as enum ('pending', 'active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type modality_type as enum ('stroke', 'stableford', 'match1v1', 'matchpairs');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------
-- players: un perfil por cada usuario de auth.users
-- -------------------------------------------------------------------------
create table if not exists players (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  handicap numeric(4,1) not null default 36.0,
  role app_role not null default 'player',
  status player_status not null default 'pending',
  avatar_color text not null default '#2f6f4f',
  created_at timestamptz not null default now()
);

-- Cuando alguien se registra en auth.users, se crea automáticamente su fila en players
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.players (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- -------------------------------------------------------------------------
-- courses / course_holes
-- -------------------------------------------------------------------------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  par int not null default 72,
  created_by uuid references players(id),
  created_at timestamptz not null default now()
);

create table if not exists course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  par int not null check (par between 3 and 6),
  stroke_index int not null check (stroke_index between 1 and 18),
  unique (course_id, hole_number),
  unique (course_id, stroke_index)
);

-- -------------------------------------------------------------------------
-- seasons: cada modalidad tiene sus propias temporadas con fechas propias
-- -------------------------------------------------------------------------
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  modality modality_type not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- -------------------------------------------------------------------------
-- rounds: una tarjeta de resultados, jugada en un campo concreto.
-- Cada ronda pertenece a UNA sola temporada y por tanto a UNA sola modalidad
-- (la modalidad de la temporada elegida): la misma tarjeta no reparte
-- resultados entre varias modalidades. Si una tarjeta es de match1v1 o
-- matchpairs, team_a/team_b guardan quién juega contra quién (1 jugador por
-- equipo en 1vs1, 2 en parejas); en golpes/stableford quedan vacíos.
-- -------------------------------------------------------------------------
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  season_id uuid not null references seasons(id),
  played_on date not null,
  notes text,
  team_a uuid[],
  team_b uuid[],
  -- Si es false, la partida se juega "scratch" (como si todos tuvieran
  -- hándicap 0): no se reparten golpes de hándicap al calcular el neto,
  -- los puntos Stableford ni el match play de esta ronda en concreto. El
  -- hándicap real de cada jugador se sigue guardando en round_players para
  -- el histórico/gráfica de evolución.
  use_handicap boolean not null default true,
  created_by uuid references players(id),
  created_at timestamptz not null default now()
);

create index if not exists rounds_season_id_idx on rounds(season_id);

create table if not exists round_players (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id),
  handicap numeric(4,1) not null,
  primary key (round_id, player_id)
);

create table if not exists hole_scores (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id),
  hole_number int not null check (hole_number between 1 and 18),
  strokes int not null check (strokes between 1 and 15),
  primary key (round_id, player_id, hole_number)
);

-- -------------------------------------------------------------------------
-- Helpers de seguridad
-- -------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from players
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function is_active_player()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from players
    where id = auth.uid() and status = 'active'
  );
$$;

-- -------------------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------------------
alter table players enable row level security;
alter table courses enable row level security;
alter table course_holes enable row level security;
alter table seasons enable row level security;
alter table rounds enable row level security;
alter table round_players enable row level security;
alter table hole_scores enable row level security;

-- players: cualquier usuario autenticado puede ver la lista (nombres, hcp...).
-- Solo el propio admin puede modificar filas (altas, hcp, roles...).
drop policy if exists "players_select" on players;
create policy "players_select" on players for select
  to authenticated using (true);

drop policy if exists "players_update_admin" on players;
create policy "players_update_admin" on players for update
  to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "players_delete_admin" on players;
create policy "players_delete_admin" on players for delete
  to authenticated using (is_admin());

-- courses / course_holes: lectura para todos los activos, escritura solo admin
drop policy if exists "courses_select" on courses;
create policy "courses_select" on courses for select to authenticated using (is_active_player());
drop policy if exists "courses_write_admin" on courses;
create policy "courses_write_admin" on courses for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "course_holes_select" on course_holes;
create policy "course_holes_select" on course_holes for select to authenticated using (is_active_player());
drop policy if exists "course_holes_write_admin" on course_holes;
create policy "course_holes_write_admin" on course_holes for all to authenticated
  using (is_admin()) with check (is_admin());

-- seasons: lectura para todos, escritura solo admin
drop policy if exists "seasons_select" on seasons;
create policy "seasons_select" on seasons for select to authenticated using (is_active_player());
drop policy if exists "seasons_write_admin" on seasons;
create policy "seasons_write_admin" on seasons for all to authenticated
  using (is_admin()) with check (is_admin());

-- rounds y datos asociados: cualquier jugador activo puede crear/leer;
-- solo el creador de la ronda o un admin pueden editar/borrar.
drop policy if exists "rounds_select" on rounds;
create policy "rounds_select" on rounds for select to authenticated using (is_active_player());
drop policy if exists "rounds_insert" on rounds;
create policy "rounds_insert" on rounds for insert to authenticated with check (is_active_player());
drop policy if exists "rounds_update" on rounds;
create policy "rounds_update" on rounds for update to authenticated
  using (is_admin() or created_by = auth.uid());
drop policy if exists "rounds_delete" on rounds;
create policy "rounds_delete" on rounds for delete to authenticated
  using (is_admin() or created_by = auth.uid());

drop policy if exists "round_players_select" on round_players;
create policy "round_players_select" on round_players for select to authenticated using (is_active_player());
drop policy if exists "round_players_write" on round_players;
create policy "round_players_write" on round_players for all to authenticated
  using (is_active_player()) with check (is_active_player());

drop policy if exists "hole_scores_select" on hole_scores;
create policy "hole_scores_select" on hole_scores for select to authenticated using (is_active_player());
drop policy if exists "hole_scores_write" on hole_scores;
create policy "hole_scores_write" on hole_scores for all to authenticated
  using (is_active_player()) with check (is_active_player());

-- -------------------------------------------------------------------------
-- Fin del esquema. Recuerda (ver README.md):
--   UPDATE players SET role = 'admin', status = 'active' WHERE email = 'tu-email@ejemplo.com';
-- para convertirte en el primer administrador tras registrarte.
-- -------------------------------------------------------------------------
