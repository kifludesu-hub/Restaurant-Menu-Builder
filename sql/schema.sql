-- DESU Digital Menu Builder — Supabase schema (fixed for RLS/policy compatibility)
-- Run this entire file in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'restaurant_owner' check (role in ('restaurant_owner','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  logo_url text,
  address text,
  phone text,
  plan text not null default 'FREE' check (plan in ('FREE','BASIC','PRO')),
  subscription_status text not null default 'ACTIVE' check (subscription_status in ('ACTIVE','EXPIRED','SUSPENDED','PENDING')),
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  image_url text,
  available boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tx_ref text not null unique,
  plan text not null check (plan in ('BASIC','PRO')),
  amount numeric(12,2) not null,
  currency text not null default 'ETB',
  status text not null default 'pending' check (status in ('pending','success','failed')),
  provider_response jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists restaurants_owner_idx on public.restaurants(owner_id);
create index if not exists categories_restaurant_idx on public.categories(restaurant_id);
create index if not exists items_category_idx on public.menu_items(category_id);
create index if not exists payments_restaurant_idx on public.payments(restaurant_id);

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.payments enable row level security;

-- Security-definer helper: lets policies check "is the CURRENT caller an admin"
-- without the caller's own RLS on profiles blocking the check (avoids recursion).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Profiles
drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profile self insert" on public.profiles;
create policy "profile self insert" on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- Public restaurant read is required for QR menus.
drop policy if exists "public restaurant read" on public.restaurants;
create policy "public restaurant read" on public.restaurants for select to anon, authenticated
using (true);

drop policy if exists "owner restaurant insert" on public.restaurants;
create policy "owner restaurant insert" on public.restaurants for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists "owner restaurant update" on public.restaurants;
create policy "owner restaurant update" on public.restaurants for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owner restaurant delete" on public.restaurants;
create policy "owner restaurant delete" on public.restaurants for delete to authenticated
using (owner_id = auth.uid());

-- Categories: public read, owner write.
drop policy if exists "public category read" on public.categories;
create policy "public category read" on public.categories for select to anon, authenticated
using (true);

drop policy if exists "owner category insert" on public.categories;
create policy "owner category insert" on public.categories for insert to authenticated
with check (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

drop policy if exists "owner category update" on public.categories;
create policy "owner category update" on public.categories for update to authenticated
using (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()))
with check (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

drop policy if exists "owner category delete" on public.categories;
create policy "owner category delete" on public.categories for delete to authenticated
using (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

-- Menu items: public read, owner write through category ownership.
drop policy if exists "public item read" on public.menu_items;
create policy "public item read" on public.menu_items for select to anon, authenticated
using (true);

drop policy if exists "owner item insert" on public.menu_items;
create policy "owner item insert" on public.menu_items for insert to authenticated
with check (exists(select 1 from public.categories c join public.restaurants r on r.id = c.restaurant_id where c.id = category_id and r.owner_id = auth.uid()));

drop policy if exists "owner item update" on public.menu_items;
create policy "owner item update" on public.menu_items for update to authenticated
using (exists(select 1 from public.categories c join public.restaurants r on r.id = c.restaurant_id where c.id = category_id and r.owner_id = auth.uid()))
with check (exists(select 1 from public.categories c join public.restaurants r on r.id = c.restaurant_id where c.id = category_id and r.owner_id = auth.uid()));

drop policy if exists "owner item delete" on public.menu_items;
create policy "owner item delete" on public.menu_items for delete to authenticated
using (exists(select 1 from public.categories c join public.restaurants r on r.id = c.restaurant_id where c.id = category_id and r.owner_id = auth.uid()));

-- Payments are private; server-side Chapa functions use the service role key and bypass RLS entirely.
drop policy if exists "owner payment read" on public.payments;
create policy "owner payment read" on public.payments for select to authenticated
using (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

-- Create profile automatically after signup (security definer bypasses RLS, so this always works).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE
-- IMPORTANT: You cannot create the bucket via SQL on a hosted Supabase
-- project — INSERT INTO storage.buckets fails with "permission denied"
-- because the SQL editor's role does not own that table. This used to
-- silently abort every policy statement below it in the same script.
--
-- Create the bucket manually first:
--   Dashboard -> Storage -> New bucket -> name: menu-images -> Public: ON
-- Then run the policies below.
-- ============================================================

drop policy if exists "public menu image read" on storage.objects;
create policy "public menu image read" on storage.objects for select to anon, authenticated
using (bucket_id = 'menu-images');

-- Uploads/updates/deletes are scoped to a folder named after the restaurant's
-- own id (the app uploads to `${restaurant.id}/...`), so one restaurant owner
-- can never touch another restaurant's files.
drop policy if exists "owner menu image upload" on storage.objects;
create policy "owner menu image upload" on storage.objects for insert to authenticated
with check (
  bucket_id = 'menu-images'
  and exists(
    select 1 from public.restaurants r
    where r.owner_id = auth.uid()
      and r.id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "owner menu image update" on storage.objects;
create policy "owner menu image update" on storage.objects for update to authenticated
using (
  bucket_id = 'menu-images'
  and exists(
    select 1 from public.restaurants r
    where r.owner_id = auth.uid()
      and r.id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'menu-images'
  and exists(
    select 1 from public.restaurants r
    where r.owner_id = auth.uid()
      and r.id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "owner menu image delete" on storage.objects;
create policy "owner menu image delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'menu-images'
  and exists(
    select 1 from public.restaurants r
    where r.owner_id = auth.uid()
      and r.id::text = (storage.foldername(name))[1]
  )
);

-- Admins: after creating your own account, promote it manually:
-- update public.profiles set role='admin' where id='YOUR_AUTH_USER_UUID';
