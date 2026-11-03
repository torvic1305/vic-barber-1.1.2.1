create extension if not exists btree_gist with schema extensions;
create schema if not exists private;

create table public.shop_settings (
  id smallint primary key check (id = 1),
  name text not null default 'Mi barbería',
  address text,
  phone text,
  timezone text not null default 'America/Mexico_City',
  open_time time not null default '10:00',
  close_time time not null default '20:00',
  break_start time,
  break_end time,
  work_days smallint[] not null default array[1, 2, 3, 4, 5, 6]::smallint[],
  min_notice_minutes integer not null default 30 check (min_notice_minutes >= 0),
  max_days_ahead integer not null default 60 check (max_days_ahead between 1 and 365),
  updated_at timestamptz not null default now(),
  check (open_time < close_time),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_start < break_end and open_time <= break_start and break_end <= close_time)),
  check (cardinality(work_days) > 0),
  check (work_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
);

insert into public.shop_settings (id) values (1);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  phone text,
  role text not null default 'client' check (role in ('client', 'staff', 'admin')),
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  description text check (description is null or char_length(description) <= 500),
  price numeric(10, 2) not null check (price >= 0),
  duration_minutes smallint not null check (duration_minutes between 5 and 480),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.staff_public (
  id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  bio text check (bio is null or char_length(bio) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.staff_services (
  staff_id uuid not null references public.staff_public (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (staff_id, service_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  customer_name text not null,
  service_id uuid not null references public.services (id) on delete restrict,
  service_name text not null,
  staff_id uuid not null references public.staff_public (id) on delete restrict,
  staff_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes smallint not null check (duration_minutes between 5 and 480),
  price numeric(10, 2) not null check (price >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  constraint appointments_no_staff_overlap
    exclude using gist (
      staff_id with =,
      tstzrange(start_at, end_at, '[)') with &&
    )
    where (status in ('pending', 'confirmed')),
  constraint appointments_no_customer_overlap
    exclude using gist (
      customer_id with =,
      tstzrange(start_at, end_at, '[)') with &&
    )
    where (status in ('pending', 'confirmed'))
);

create index appointments_customer_start_idx on public.appointments (customer_id, start_at);
create index appointments_staff_start_idx on public.appointments (staff_id, start_at);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Cliente'),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.create_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_start_local timestamp without time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_customer_name text;
  v_service public.services%rowtype;
  v_staff public.staff_public%rowtype;
  v_settings public.shop_settings%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_end_local timestamp without time zone;
  v_appointment_id uuid;
begin
  if v_customer_id is null then
    raise exception 'Debes iniciar sesión para reservar.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_customer_id and role = 'client'
  ) then
    raise exception 'Esta cuenta no puede reservar citas.';
  end if;

  if p_start_local is null then
    raise exception 'Selecciona fecha y hora.';
  end if;

  select * into strict v_settings from public.shop_settings where id = 1;
  select * into v_service
  from public.services
  where id = p_service_id and is_active;

  if not found then
    raise exception 'El servicio ya no está disponible.';
  end if;

  select * into v_staff
  from public.staff_public
  where id = p_staff_id and is_active;

  if not found or not exists (
    select 1 from public.profiles
    where id = p_staff_id and role = 'staff'
  ) or not exists (
    select 1 from public.staff_services
    where staff_id = p_staff_id and service_id = p_service_id
  ) then
    raise exception 'El profesional no realiza este servicio.';
  end if;

  if p_start_local < (now() at time zone v_settings.timezone)
      + make_interval(mins => v_settings.min_notice_minutes)
    or p_start_local > (now() at time zone v_settings.timezone)
      + make_interval(days => v_settings.max_days_ahead) then
    raise exception 'La fecha está fuera del periodo permitido.';
  end if;

  v_end_local := p_start_local + make_interval(mins => v_service.duration_minutes);

  if not (extract(isodow from p_start_local)::smallint = any (v_settings.work_days))
      or p_start_local::time < v_settings.open_time
      or v_end_local::date <> p_start_local::date
      or v_end_local::time > v_settings.close_time then
    raise exception 'El horario está fuera del horario del negocio.';
  end if;

  if v_settings.break_start is not null
      and p_start_local::time < v_settings.break_end
      and v_end_local::time > v_settings.break_start then
    raise exception 'El horario coincide con el descanso del negocio.';
  end if;

  v_start := p_start_local at time zone v_settings.timezone;
  v_end := v_end_local at time zone v_settings.timezone;

  select display_name into strict v_customer_name
  from public.profiles
  where id = v_customer_id;

  insert into public.appointments (
    customer_id, customer_name, service_id, service_name, staff_id, staff_name,
    start_at, end_at, duration_minutes, price
  )
  values (
    v_customer_id, v_customer_name, v_service.id, v_service.name, v_staff.id, v_staff.display_name,
    v_start, v_end, v_service.duration_minutes, v_service.price
  )
  returning id into v_appointment_id;

  return v_appointment_id;
exception
  when exclusion_violation then
    raise exception 'Ese horario acaba de ocuparse.' using errcode = '23P01';
end;
$$;

revoke all on function public.create_appointment(uuid, uuid, timestamp without time zone) from public, anon;
grant execute on function public.create_appointment(uuid, uuid, timestamp without time zone) to authenticated;

alter table public.shop_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.staff_public enable row level security;
alter table public.staff_services enable row level security;
alter table public.appointments enable row level security;

create policy "Public can read shop settings"
  on public.shop_settings for select to anon, authenticated using (true);
create policy "Admins can manage shop settings"
  on public.shop_settings for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Users can read their own profile"
  on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Clients can update their own contact details"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and role = 'client')
  with check (id = (select auth.uid()) and role = 'client');
create policy "Admins can manage profiles"
  on public.profiles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Public can read active services"
  on public.services for select to anon, authenticated using (is_active);
create policy "Admins can manage services"
  on public.services for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Public can read active staff"
  on public.staff_public for select to anon, authenticated using (is_active);
create policy "Admins can manage public staff profiles"
  on public.staff_public for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Public can read staff service assignments"
  on public.staff_services for select to anon, authenticated using (true);
create policy "Admins can manage staff service assignments"
  on public.staff_services for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Users can read appointments they are allowed to see"
  on public.appointments for select to authenticated
  using (
    customer_id = (select auth.uid())
    or staff_id = (select auth.uid())
    or private.is_admin()
  );
create policy "Admins can update appointments"
  on public.appointments for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

revoke all on public.shop_settings, public.profiles, public.services,
  public.staff_public, public.staff_services, public.appointments
  from anon, authenticated;

grant select on public.shop_settings, public.services, public.staff_public, public.staff_services
  to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.appointments to authenticated;
grant insert, update, delete on public.shop_settings, public.services,
  public.staff_public, public.staff_services to authenticated;
