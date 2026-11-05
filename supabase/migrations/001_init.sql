-- Fryselogg schema: trips and catches, with RLS so each user only sees their own data.

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  boat text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.catches (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  species text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null default 'kg',
  location text,
  caught_at timestamptz,
  temperature numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id, created_at desc);
create index if not exists catches_trip_id_idx on public.catches (trip_id, created_at desc);

alter table public.trips enable row level security;
alter table public.catches enable row level security;

create policy "Users can view their own trips"
  on public.trips for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own trips"
  on public.trips for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own trips"
  on public.trips for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own trips"
  on public.trips for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can view catches on their trips"
  on public.catches for select
  to authenticated
  using (
    exists (
      select 1 from public.trips
      where trips.id = catches.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Users can insert catches on their trips"
  on public.catches for insert
  to authenticated
  with check (
    exists (
      select 1 from public.trips
      where trips.id = catches.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Users can update catches on their trips"
  on public.catches for update
  to authenticated
  using (
    exists (
      select 1 from public.trips
      where trips.id = catches.trip_id
        and trips.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips
      where trips.id = catches.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Users can delete catches on their trips"
  on public.catches for delete
  to authenticated
  using (
    exists (
      select 1 from public.trips
      where trips.id = catches.trip_id
        and trips.user_id = auth.uid()
    )
  );
