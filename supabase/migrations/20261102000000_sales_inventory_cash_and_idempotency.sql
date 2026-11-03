create table public.appointment_requests (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, request_id)
);

alter table public.appointment_requests enable row level security;
revoke all on public.appointment_requests from public, anon, authenticated;

create or replace function public.create_appointment_idempotent(
  p_service_id uuid,
  p_staff_id uuid,
  p_start_local timestamp without time zone,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_appointment_id uuid;
begin
  if v_customer_id is null or p_request_id is null then
    raise exception 'La solicitud de reserva no es válida.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_customer_id::text || ':' || p_request_id::text));

  select appointment_id into v_appointment_id
  from public.appointment_requests
  where customer_id = v_customer_id and request_id = p_request_id;

  if found then
    return v_appointment_id;
  end if;

  v_appointment_id := public.create_appointment(p_service_id, p_staff_id, p_start_local);

  insert into public.appointment_requests (customer_id, request_id, appointment_id)
  values (v_customer_id, p_request_id, v_appointment_id);

  return v_appointment_id;
end;
$$;

revoke all on function public.create_appointment_idempotent(uuid, uuid, timestamp without time zone, uuid)
  from public, anon;
grant execute on function public.create_appointment_idempotent(uuid, uuid, timestamp without time zone, uuid)
  to authenticated;

create or replace function public.get_appointment_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
begin
  if auth.uid() is null or p_request_id is null then
    raise exception 'La solicitud de reserva no es válida.';
  end if;

  select appointment_id into v_appointment_id
  from public.appointment_requests
  where customer_id = auth.uid() and request_id = p_request_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.get_appointment_request(uuid) from public, anon;
grant execute on function public.get_appointment_request(uuid) to authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (char_length(sku) between 1 and 80),
  name text not null check (char_length(name) between 1 and 120),
  price numeric(10, 2) not null check (price >= 0),
  cost numeric(10, 2) not null default 0 check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 3 check (min_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete restrict,
  appointment_id uuid unique references public.appointments (id) on delete restrict,
  request_id uuid not null,
  payment_method text not null check (payment_method in ('cash', 'card')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  tip numeric(10, 2) not null default 0 check (tip >= 0),
  total numeric(12, 2) generated always as (subtotal + tip) stored,
  created_at timestamptz not null default now(),
  unique (seller_id, request_id)
);

create index sales_created_at_idx on public.sales (created_at);
create index sales_seller_created_at_idx on public.sales (seller_id, created_at);

create table public.sale_items (
  id bigint generated always as identity primary key,
  sale_id uuid not null references public.sales (id) on delete cascade,
  kind text not null check (kind in ('product', 'service')),
  item_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  quantity integer not null check (quantity between 1 and 1000),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored
);

create index sale_items_sale_id_idx on public.sale_items (sale_id);

create table public.cash_expenses (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null,
  description text not null check (char_length(description) between 2 and 200),
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card')),
  business_date date not null,
  created_at timestamptz not null default now(),
  unique (created_by, request_id)
);

create index cash_expenses_business_date_idx on public.cash_expenses (business_date);

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  closed_by uuid not null references public.profiles (id) on delete restrict,
  opening_float numeric(10, 2) not null check (opening_float >= 0),
  cash_sales numeric(12, 2) not null check (cash_sales >= 0),
  cash_expenses numeric(12, 2) not null check (cash_expenses >= 0),
  card_sales numeric(12, 2) not null check (card_sales >= 0),
  card_expenses numeric(12, 2) not null check (card_expenses >= 0),
  expected_cash numeric(12, 2) not null,
  counted_cash numeric(12, 2) not null check (counted_cash >= 0),
  difference numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create table public.inventory_imports (
  id uuid primary key default gen_random_uuid(),
  imported_by uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null,
  inserted_count integer not null check (inserted_count >= 0),
  updated_count integer not null check (updated_count >= 0),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (imported_by, request_id)
);

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.cash_expenses enable row level security;
alter table public.cash_closings enable row level security;
alter table public.inventory_imports enable row level security;

create policy "Staff and admins can read active products"
  on public.products for select to authenticated
  using (
    is_active
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('staff', 'admin')
    )
  );
create policy "Admins can manage products"
  on public.products for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "Sellers and admins can read sales"
  on public.sales for select to authenticated
  using (seller_id = (select auth.uid()) or private.is_admin());
create policy "Sellers and admins can read sale items"
  on public.sale_items for select to authenticated
  using (
    exists (
      select 1 from public.sales
      where id = sale_id
        and (seller_id = (select auth.uid()) or private.is_admin())
    )
  );
create policy "Admins can read cash expenses"
  on public.cash_expenses for select to authenticated
  using (private.is_admin());
create policy "Admins can read cash closings"
  on public.cash_closings for select to authenticated
  using (private.is_admin());
create policy "Admins can read inventory imports"
  on public.inventory_imports for select to authenticated
  using (private.is_admin());

revoke all on public.products, public.sales, public.sale_items, public.cash_expenses,
  public.cash_closings, public.inventory_imports from anon, authenticated;
grant select on public.products, public.sales, public.sale_items, public.cash_expenses,
  public.cash_closings, public.inventory_imports to authenticated;

create or replace function public.import_inventory(
  p_request_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_updated integer := 0;
  v_existing integer;
  v_row jsonb;
  v_sku text;
  v_name text;
  v_price numeric;
  v_cost numeric;
  v_stock integer;
  v_min_stock integer;
  v_product_id uuid;
  v_result jsonb;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Solo el administrador puede importar inventario.';
  end if;
  if p_request_id is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'El archivo debe contener entre 1 y 5000 productos.';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 5000 then
    raise exception 'El archivo debe contener entre 1 y 5000 productos.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':inventory:' || p_request_id::text));
  perform 1 from public.shop_settings where id = 1 for update;

  select result into v_result
  from public.inventory_imports
  where imported_by = v_user_id and request_id = p_request_id;
  if found then
    return v_result;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as entry(value)
    group by upper(trim(entry.value ->> 'sku'))
    having count(*) > 1
  ) then
    raise exception 'El archivo contiene SKU o códigos repetidos.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_sku := upper(trim(coalesce(v_row ->> 'sku', '')));
    v_name := trim(coalesce(v_row ->> 'name', ''));
    if v_sku = '' or char_length(v_sku) > 80 or v_name = '' or char_length(v_name) > 120
        or coalesce(v_row ->> 'price', '') !~ '^\d+(\.\d{1,2})?$'
        or coalesce(v_row ->> 'cost', '0') !~ '^\d+(\.\d{1,2})?$'
        or coalesce(v_row ->> 'stock', '') !~ '^\d+$'
        or coalesce(v_row ->> 'min_stock', '3') !~ '^\d+$' then
      raise exception 'Hay una fila con SKU, nombre, precio, costo o existencias inválidos.';
    end if;

    v_price := (v_row ->> 'price')::numeric;
    v_cost := coalesce(nullif(v_row ->> 'cost', ''), '0')::numeric;
    v_stock := (v_row ->> 'stock')::integer;
    v_min_stock := coalesce(nullif(v_row ->> 'min_stock', ''), '3')::integer;
    if v_price > 10000000 or v_cost > 10000000 or v_stock > 10000000 or v_min_stock > 10000000 then
      raise exception 'Hay una fila que excede los máximos permitidos.';
    end if;

    select id into v_product_id from public.products where sku = v_sku;
    if found then
      v_updated := v_updated + 1;
    else
      v_inserted := v_inserted + 1;
    end if;

    insert into public.products (sku, name, price, cost, stock, min_stock, updated_at)
    values (v_sku, v_name, v_price, v_cost, v_stock, v_min_stock, now())
    on conflict (sku) do update
      set name = excluded.name,
          price = excluded.price,
          cost = excluded.cost,
          stock = excluded.stock,
          min_stock = excluded.min_stock,
          is_active = true,
          updated_at = now();
  end loop;

  v_result := jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
  insert into public.inventory_imports (imported_by, request_id, inserted_count, updated_count, result)
  values (v_user_id, p_request_id, v_inserted, v_updated, v_result);

  return v_result;
end;
$$;

create or replace function public.create_sale(
  p_request_id uuid,
  p_payment_method text,
  p_tip numeric,
  p_items jsonb,
  p_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_timezone text;
  v_business_date date;
  v_created_at timestamptz;
  v_sale_id uuid;
  v_item jsonb;
  v_kind text;
  v_item_id uuid;
  v_quantity integer;
  v_name text;
  v_price numeric;
  v_cost numeric;
  v_stock integer;
  v_appointment public.appointments%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_lines jsonb := '[]'::jsonb;
begin
  if v_user_id is null or p_request_id is null then
    raise exception 'La solicitud de venta no es válida.';
  end if;
  select role into v_role from public.profiles where id = v_user_id;
  if v_role is null or v_role not in ('staff', 'admin') then
    raise exception 'Esta cuenta no puede registrar ventas.';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'card')
      or p_tip is null or p_tip < 0 or p_tip > 10000000 or p_tip <> round(p_tip, 2)
      or p_items is null or jsonb_typeof(p_items) <> 'array'
      or jsonb_array_length(p_items) > 30
      or (p_appointment_id is null and jsonb_array_length(p_items) = 0) then
    raise exception 'Revisa los productos, el método de pago y la propina.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':sale:' || p_request_id::text));
  select id into v_sale_id from public.sales
  where seller_id = v_user_id and request_id = p_request_id;
  if found then
    return v_sale_id;
  end if;

  select timezone into strict v_timezone
  from public.shop_settings where id = 1 for update;
  v_created_at := clock_timestamp();
  v_business_date := (v_created_at at time zone v_timezone)::date;
  if exists (select 1 from public.cash_closings where business_date = v_business_date) then
    raise exception 'La caja de hoy ya está cerrada.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(value)
    group by entry.value ->> 'kind', entry.value ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'El ticket no puede repetir productos o servicios.';
  end if;

  if p_appointment_id is not null then
    if exists (
      select 1 from jsonb_array_elements(p_items) as entry(value)
      where entry.value ->> 'kind' = 'service'
    ) then
      raise exception 'No agregues servicios manuales al cobrar una cita.';
    end if;

    select * into v_appointment
    from public.appointments
    where id = p_appointment_id
    for update;
    if not found
        or v_appointment.status not in ('pending', 'confirmed')
        or v_appointment.start_at > now()
        or (v_role = 'staff' and v_appointment.staff_id <> v_user_id) then
      raise exception 'La cita no está disponible para cobrar.';
    end if;

    v_subtotal := v_appointment.price;
    v_lines := jsonb_build_array(jsonb_build_object(
      'kind', 'service',
      'item_id', v_appointment.service_id,
      'name', v_appointment.service_name,
      'quantity', 1,
      'unit_price', v_appointment.price,
      'unit_cost', 0
    ));
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_kind := v_item ->> 'kind';
    if v_kind is null or v_kind not in ('product', 'service')
        or coalesce(v_item ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or coalesce(v_item ->> 'quantity', '') !~ '^[1-9][0-9]{0,2}$' then
      raise exception 'Hay un artículo inválido en el ticket.';
    end if;
    v_item_id := (v_item ->> 'id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_kind = 'product' then
      select name, price, cost, stock
      into v_name, v_price, v_cost, v_stock
      from public.products
      where id = v_item_id and is_active
      for update;
      if not found then
        raise exception 'Uno de los productos ya no está disponible.';
      end if;
      if v_stock < v_quantity then
        raise exception 'No hay existencias suficientes para %.', v_name;
      end if;
      update public.products
      set stock = stock - v_quantity, updated_at = now()
      where id = v_item_id;
    else
      if p_appointment_id is not null then
        raise exception 'No agregues servicios manuales al cobrar una cita.';
      end if;
      select name, price, 0
      into v_name, v_price, v_cost
      from public.services
      where id = v_item_id and is_active;
      if not found then
        raise exception 'Uno de los servicios ya no está disponible.';
      end if;
    end if;

    v_subtotal := v_subtotal + v_price * v_quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'kind', v_kind,
      'item_id', v_item_id,
      'name', v_name,
      'quantity', v_quantity,
      'unit_price', v_price,
      'unit_cost', v_cost
    ));
  end loop;

  insert into public.sales (seller_id, appointment_id, request_id, payment_method, subtotal, tip, created_at)
  values (v_user_id, p_appointment_id, p_request_id, p_payment_method, v_subtotal, p_tip, v_created_at)
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(v_lines)
  loop
    insert into public.sale_items (
      sale_id, kind, item_id, name, quantity, unit_price, unit_cost
    )
    values (
      v_sale_id,
      v_item ->> 'kind',
      (v_item ->> 'item_id')::uuid,
      v_item ->> 'name',
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'unit_cost')::numeric
    );
  end loop;

  if p_appointment_id is not null then
    update public.appointments set status = 'completed' where id = p_appointment_id;
  end if;

  return v_sale_id;
end;
$$;

create or replace function public.create_cash_expense(
  p_request_id uuid,
  p_business_date date,
  p_description text,
  p_amount numeric,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_expense_id uuid;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Solo el administrador puede registrar gastos.';
  end if;
  if p_request_id is null or p_business_date is null
      or char_length(trim(coalesce(p_description, ''))) not between 2 and 200
      or p_amount is null or p_amount <= 0 or p_amount > 10000000 or p_amount <> round(p_amount, 2)
      or p_payment_method is null or p_payment_method not in ('cash', 'card') then
    raise exception 'Revisa los datos del gasto.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':expense:' || p_request_id::text));
  select id into v_expense_id from public.cash_expenses
  where created_by = v_user_id and request_id = p_request_id;
  if found then
    return v_expense_id;
  end if;

  select timezone into strict v_timezone
  from public.shop_settings where id = 1 for update;
  if p_business_date > (clock_timestamp() at time zone v_timezone)::date then
    raise exception 'No se pueden registrar gastos con fecha futura.';
  end if;
  if exists (select 1 from public.cash_closings where business_date = p_business_date) then
    raise exception 'No se pueden agregar gastos a una caja ya cerrada.';
  end if;

  insert into public.cash_expenses (
    created_by, request_id, description, amount, payment_method, business_date
  )
  values (
    v_user_id, p_request_id, trim(p_description), p_amount, p_payment_method, p_business_date
  )
  returning id into v_expense_id;

  return v_expense_id;
end;
$$;

create or replace function public.close_cash(
  p_business_date date,
  p_opening_float numeric,
  p_counted_cash numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_cash_sales numeric(12, 2);
  v_cash_expenses numeric(12, 2);
  v_card_sales numeric(12, 2);
  v_card_expenses numeric(12, 2);
  v_expected_cash numeric(12, 2);
  v_closing public.cash_closings%rowtype;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Solo el administrador puede cerrar la caja.';
  end if;
  if p_business_date is null or p_opening_float is null or p_opening_float < 0
      or p_counted_cash is null or p_counted_cash < 0
      or p_opening_float > 10000000 or p_counted_cash > 10000000 then
    raise exception 'Revisa el fondo inicial y el efectivo contado.';
  end if;
  if p_opening_float <> round(p_opening_float, 2)
      or p_counted_cash <> round(p_counted_cash, 2) then
    raise exception 'Usa máximo dos decimales para los importes de caja.';
  end if;

  select timezone into strict v_timezone
  from public.shop_settings where id = 1 for update;
  if p_business_date > (clock_timestamp() at time zone v_timezone)::date then
    raise exception 'No se puede cerrar una fecha futura.';
  end if;

  select * into v_closing from public.cash_closings
  where business_date = p_business_date;
  if found then
    return jsonb_build_object(
      'id', v_closing.id,
      'business_date', v_closing.business_date,
      'opening_float', v_closing.opening_float,
      'cash_sales', v_closing.cash_sales,
      'cash_expenses', v_closing.cash_expenses,
      'card_sales', v_closing.card_sales,
      'card_expenses', v_closing.card_expenses,
      'expected_cash', v_closing.expected_cash,
      'counted_cash', v_closing.counted_cash,
      'difference', v_closing.difference
    );
  end if;

  select
    coalesce(sum(total) filter (where payment_method = 'cash'), 0),
    coalesce(sum(total) filter (where payment_method = 'card'), 0)
  into v_cash_sales, v_card_sales
  from public.sales
  where (created_at at time zone v_timezone)::date = p_business_date;

  select
    coalesce(sum(amount) filter (where payment_method = 'cash'), 0),
    coalesce(sum(amount) filter (where payment_method = 'card'), 0)
  into v_cash_expenses, v_card_expenses
  from public.cash_expenses
  where business_date = p_business_date;

  v_expected_cash := p_opening_float + v_cash_sales - v_cash_expenses;

  insert into public.cash_closings (
    business_date, closed_by, opening_float, cash_sales, cash_expenses,
    card_sales, card_expenses, expected_cash, counted_cash, difference
  )
  values (
    p_business_date, v_user_id, p_opening_float, v_cash_sales, v_cash_expenses,
    v_card_sales, v_card_expenses, v_expected_cash, p_counted_cash, p_counted_cash - v_expected_cash
  )
  returning * into v_closing;

  return jsonb_build_object(
    'id', v_closing.id,
    'business_date', v_closing.business_date,
    'opening_float', v_closing.opening_float,
    'cash_sales', v_closing.cash_sales,
    'cash_expenses', v_closing.cash_expenses,
    'card_sales', v_closing.card_sales,
    'card_expenses', v_closing.card_expenses,
    'expected_cash', v_closing.expected_cash,
    'counted_cash', v_closing.counted_cash,
    'difference', v_closing.difference
  );
end;
$$;

create or replace function public.get_cash_summary(p_business_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_cash_sales numeric(12, 2);
  v_card_sales numeric(12, 2);
  v_cash_expenses numeric(12, 2);
  v_card_expenses numeric(12, 2);
begin
  if auth.uid() is null or not private.is_admin() or p_business_date is null then
    raise exception 'Solo el administrador puede consultar el corte de caja.';
  end if;

  select timezone into strict v_timezone
  from public.shop_settings where id = 1;
  v_start := p_business_date::timestamp at time zone v_timezone;
  v_end := (p_business_date + 1)::timestamp at time zone v_timezone;

  select
    coalesce(sum(total) filter (where payment_method = 'cash'), 0),
    coalesce(sum(total) filter (where payment_method = 'card'), 0)
  into v_cash_sales, v_card_sales
  from public.sales
  where created_at >= v_start and created_at < v_end;

  select
    coalesce(sum(amount) filter (where payment_method = 'cash'), 0),
    coalesce(sum(amount) filter (where payment_method = 'card'), 0)
  into v_cash_expenses, v_card_expenses
  from public.cash_expenses
  where business_date = p_business_date;

  return jsonb_build_object(
    'cash_sales', v_cash_sales,
    'card_sales', v_card_sales,
    'cash_expenses', v_cash_expenses,
    'card_expenses', v_card_expenses
  );
end;
$$;

revoke all on function public.import_inventory(uuid, jsonb) from public, anon;
revoke all on function public.create_sale(uuid, text, numeric, jsonb, uuid) from public, anon;
revoke all on function public.create_cash_expense(uuid, date, text, numeric, text) from public, anon;
revoke all on function public.close_cash(date, numeric, numeric) from public, anon;
revoke all on function public.get_cash_summary(date) from public, anon;
grant execute on function public.import_inventory(uuid, jsonb) to authenticated;
grant execute on function public.create_sale(uuid, text, numeric, jsonb, uuid) to authenticated;
grant execute on function public.create_cash_expense(uuid, date, text, numeric, text) to authenticated;
grant execute on function public.close_cash(date, numeric, numeric) to authenticated;
grant execute on function public.get_cash_summary(date) to authenticated;
